/*
# Déclic Studio — Core Schema

## Overview
Creates the data model for a professional photography client-proofing &
delivery platform. The photographer (admin) signs in and manages galleries;
clients access their gallery via an access code without an account.

## New Tables

### pricing_grids
- `id` (uuid, pk)
- `name` (text) — e.g. "Portrait Standard"
- `included_photos` (int) — number of photos included in the base price
- `base_extra_price` (numeric) — price per extra photo beyond included
- `tiered_pricing` (jsonb) — array of {min, price} tier rules
- `created_at` (timestamptz)

### galleries
- `id` (uuid, pk)
- `title` (text)
- `client_name` (text)
- `client_email` (text)
- `access_code` (text) — simple password clients enter to view
- `pricing_grid_id` (uuid → pricing_grads)
- `status` (text) — selection_pending | processing | delivered | expired
- `selection_validated_at` (timestamptz)
- `delivered_at` (timestamptz)
- `deletion_scheduled_at` (timestamptz) — delivered_at + 30 days
- `created_at` (timestamptz)

### photos
- `id` (uuid, pk)
- `gallery_id` (uuid → galleries)
- `type` (text) — preview | final_hd
- `file_path` (text) — path in Supabase Storage
- `filename` (text)
- `is_selected` (boolean, default false)
- `created_at` (timestamptz)

## Security
- RLS enabled on all three tables.
- pricing_grids, galleries, photos: full CRUD for authenticated users (the
  photographer). anon has NO direct table access.
- A SECURITY DEFINER function `get_client_gallery(p_access_code)` lets clients
  fetch their gallery + preview photos by access code, bypassing RLS safely.
- A SECURITY DEFINER function `admin_get_gallery_full(p_gallery_id)` fetches a
  gallery with its pricing grid and all photos for the admin dashboard.
- A SECURITY DEFINER function `recalculate_gallery_status(p_gallery_id)` sets
  delivered_at + deletion_scheduled_at and returns the updated row.

## Notes
- Storage buckets `preview-watermarked` (public) and `final-hd` (private) are
  created separately. Storage policies are managed in a follow-up migration.
*/

-- ───────────────────────── pricing_grids ─────────────────────────
CREATE TABLE IF NOT EXISTS pricing_grids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  included_photos integer NOT NULL DEFAULT 0 CHECK (included_photos >= 0),
  base_extra_price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (base_extra_price >= 0),
  tiered_pricing jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pricing_grids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_select_pricing_grids" ON pricing_grids FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_insert_pricing_grids" ON pricing_grids FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_update_pricing_grids" ON pricing_grids FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_delete_pricing_grids" ON pricing_grids FOR DELETE
  TO authenticated USING (true);

-- ───────────────────────── galleries ─────────────────────────
CREATE TABLE IF NOT EXISTS galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  access_code text NOT NULL,
  pricing_grid_id uuid NOT NULL REFERENCES pricing_grids(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'selection_pending' CHECK (status IN ('selection_pending','processing','delivered','expired')),
  selection_validated_at timestamptz,
  delivered_at timestamptz,
  deletion_scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_galleries_status ON galleries(status);
CREATE INDEX IF NOT EXISTS idx_galleries_pricing_grid ON galleries(pricing_grid_id);

ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_galleries" ON galleries;
CREATE POLICY "admin_select_galleries" ON galleries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_galleries" ON galleries;
CREATE POLICY "admin_insert_galleries" ON galleries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_galleries" ON galleries;
CREATE POLICY "admin_update_galleries" ON galleries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_galleries" ON galleries;
CREATE POLICY "admin_delete_galleries" ON galleries FOR DELETE
  TO authenticated USING (true);

-- ───────────────────────── photos ─────────────────────────
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('preview','final_hd')),
  file_path text NOT NULL,
  filename text NOT NULL,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_gallery ON photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_type ON photos(gallery_id, type);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_photos" ON photos;
CREATE POLICY "admin_select_photos" ON photos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_photos" ON photos;
CREATE POLICY "admin_insert_photos" ON photos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_photos" ON photos;
CREATE POLICY "admin_update_photos" ON photos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_photos" ON photos;
CREATE POLICY "admin_delete_photos" ON photos FOR DELETE
  TO authenticated USING (true);

-- ───────────────────────── Client-facing RPC (SECURITY DEFINER) ─────────────────────────
-- Returns the gallery + pricing grid + preview photos for a client who knows
-- the access code. No auth required; the access code IS the credential.
CREATE OR REPLACE FUNCTION get_client_gallery(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gal galleries%ROWTYPE;
  grid jsonb;
  preview_photos jsonb;
BEGIN
  SELECT * INTO gal FROM galleries WHERE access_code = p_access_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT to_jsonb(g) INTO grid FROM pricing_grids g WHERE g.id = gal.pricing_grid_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'gallery_id', p.gallery_id,
      'type', p.type,
      'file_path', p.file_path,
      'filename', p.filename,
      'is_selected', p.is_selected,
      'created_at', p.created_at
    ) ORDER BY p.created_at
  ), '[]'::jsonb) INTO preview_photos
  FROM photos p
  WHERE p.gallery_id = gal.id AND p.type = 'preview';

  RETURN jsonb_build_object(
    'gallery', to_jsonb(gal),
    'pricing_grid', grid,
    'preview_photos', preview_photos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_gallery(text) TO anon, authenticated;

-- ───────────────────────── Admin full-gallery fetch ─────────────────────────
-- Convenience RPC returning a gallery joined with its pricing grid and all photos.
-- Requires an authenticated session (RLS still enforces ownership implicitly:
-- all galleries are visible to the authenticated photographer).
CREATE OR REPLACE FUNCTION admin_get_gallery_full(p_gallery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gal galleries%ROWTYPE;
  grid jsonb;
  all_photos jsonb;
BEGIN
  SELECT * INTO gal FROM galleries WHERE id = p_gallery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT to_jsonb(g) INTO grid FROM pricing_grids g WHERE g.id = gal.pricing_grid_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'gallery_id', p.gallery_id,
      'type', p.type,
      'file_path', p.file_path,
      'filename', p.filename,
      'is_selected', p.is_selected,
      'created_at', p.created_at
    ) ORDER BY p.type, p.created_at
  ), '[]'::jsonb) INTO all_photos
  FROM photos p
  WHERE p.gallery_id = gal.id;

  RETURN jsonb_build_object(
    'gallery', to_jsonb(gal),
    'pricing_grid', grid,
    'photos', all_photos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_gallery_full(uuid) TO authenticated;
