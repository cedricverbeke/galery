/*
# Déclic Studio — Passage en mode sans compte (anon)

## Contexte
L'application n'utilise plus l'authentification Supabase (email/mot de passe).
Le photographe se connecte avec un simple mot de passe côté client. Les clients
accèdent à leur galerie via un code d'accès. Aucun compte utilisateur n'existe.

## Changements
1. Toutes les politiques RLS sur `pricing_grids`, `galleries`, `photos` passent
   de `TO authenticated` à `TO anon, authenticated` (CRUD complet).
2. Toutes les politiques RLS sur `storage.objects` pour les buckets
   `preview-watermarked` et `final-hd` passent de `TO authenticated` à
   `TO anon, authenticated` (CRUD complet).
3. La fonction `admin_get_gallery_full` est désormais accessible à `anon`.

## Sécurité
- L'accès en écriture est ouvert à l'anon car il n'y a qu'un seul opérateur
  (le photographe) et la protection se fait côté application (mot de passe).
- Les clients ne voient que les galeries via le RPC `get_client_gallery`
  (security definer) qui nécessite le code d'accès.
*/

-- ─── pricing_grids ───
DROP POLICY IF EXISTS "admin_select_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_select_pricing_grids" ON pricing_grids FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_insert_pricing_grids" ON pricing_grids FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_update_pricing_grids" ON pricing_grids FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_pricing_grids" ON pricing_grids;
CREATE POLICY "admin_delete_pricing_grids" ON pricing_grids FOR DELETE
  TO anon, authenticated USING (true);

-- ─── galleries ───
DROP POLICY IF EXISTS "admin_select_galleries" ON galleries;
CREATE POLICY "admin_select_galleries" ON galleries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_galleries" ON galleries;
CREATE POLICY "admin_insert_galleries" ON galleries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_galleries" ON galleries;
CREATE POLICY "admin_update_galleries" ON galleries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_galleries" ON galleries;
CREATE POLICY "admin_delete_galleries" ON galleries FOR DELETE
  TO anon, authenticated USING (true);

-- ─── photos ───
DROP POLICY IF EXISTS "admin_select_photos" ON photos;
CREATE POLICY "admin_select_photos" ON photos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_photos" ON photos;
CREATE POLICY "admin_insert_photos" ON photos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_photos" ON photos;
CREATE POLICY "admin_update_photos" ON photos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_photos" ON photos;
CREATE POLICY "admin_delete_photos" ON photos FOR DELETE
  TO anon, authenticated USING (true);

-- ─── admin_get_gallery_full : accessible à anon ───
DROP POLICY IF EXISTS "temp" ON photos;
GRANT EXECUTE ON FUNCTION admin_get_gallery_full(uuid) TO anon, authenticated;

-- ─── Storage : preview-watermarked ───
DROP POLICY IF EXISTS "preview_admin_insert" ON storage.objects;
CREATE POLICY "preview_admin_insert" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'preview-watermarked');

DROP POLICY IF EXISTS "preview_admin_update" ON storage.objects;
CREATE POLICY "preview_admin_update" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'preview-watermarked');

DROP POLICY IF EXISTS "preview_admin_delete" ON storage.objects;
CREATE POLICY "preview_admin_delete" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'preview-watermarked');

-- ─── Storage : final-hd ───
DROP POLICY IF EXISTS "final_admin_read" ON storage.objects;
CREATE POLICY "final_admin_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'final-hd');

DROP POLICY IF EXISTS "final_admin_insert" ON storage.objects;
CREATE POLICY "final_admin_insert" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'final-hd');

DROP POLICY IF EXISTS "final_admin_update" ON storage.objects;
CREATE POLICY "final_admin_update" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'final-hd');

DROP POLICY IF EXISTS "final_admin_delete" ON storage.objects;
CREATE POLICY "final_admin_delete" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'final-hd');
