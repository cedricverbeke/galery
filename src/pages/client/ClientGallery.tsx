import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { supabase, PREVIEW_BUCKET } from '@/lib/supabase';
import type { Gallery, PricingGrid, Photo } from '@/types';
import { calculateExtraPrice } from '@/types';
import { formatEuro } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { navigate } from '@/lib/router';

interface ClientGalleryData {
  gallery: Gallery;
  pricing_grid: PricingGrid;
  preview_photos: Photo[];
}

export function ClientGallery({ id }: { id: string }) {
  const [data, setData] = useState<ClientGalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: gal, error: galErr } = await supabase
      .from('galleries')
      .select('*, pricing_grid:pricing_grids(*)')
      .eq('id', id)
      .maybeSingle();
    if (galErr || !gal) {
      setError('Galerie introuvable ou indisponible.');
      setLoading(false);
      return;
    }
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('gallery_id', id)
      .eq('type', 'preview')
      .order('created_at', { ascending: true });

    const grid = (gal as Gallery & { pricing_grid: PricingGrid }).pricing_grid;
    setData({
      gallery: gal as Gallery,
      pricing_grid: grid,
      preview_photos: photos ?? [],
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const photos = data?.preview_photos ?? [];
  const grid = data?.pricing_grid;
  const gallery = data?.gallery;

  const selectedCount = selectedIds.size;
  const pricing = useMemo(() => {
    if (!grid) return { extraCount: 0, extraCost: 0, total: 0 };
    return calculateExtraPrice(grid, selectedCount);
  }, [grid, selectedCount]);

  const toggleSelect = (photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const photoUrl = (path: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${path}`;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  const prevPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxIndex, photos.length]);

  const onValidate = async () => {
    if (!gallery || !grid) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const selectedPhotoIds = Array.from(selectedIds);

      if (pricing.total === 0) {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gallery_id: gallery.id,
            selected_photo_ids: selectedPhotoIds,
            free_validation: true,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Validation échouée (${res.status})`);
        }
        const body = await res.json();
        if (body.status === 'validated') {
          navigate('/access');
          return;
        }
        throw new Error(body.error ?? 'Validation échouée.');
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gallery_id: gallery.id,
          selected_photo_ids: selectedPhotoIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Paiement échoué (${res.status})`);
      }
      const body = await res.json();
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      throw new Error(body.error ?? 'Aucune URL de paiement renvoyée.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setCheckoutError(msg);
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-muted">Chargement de votre galerie…</p>
      </div>
    );
  }

  if (error || !gallery || !grid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Logo size="md" />
        <p className="mt-8 text-sm text-muted">{error ?? 'Galerie indisponible.'}</p>
        <Button variant="ghost" onClick={() => navigate('/access')} className="mt-6">
          <ArrowLeft size={16} /> Retour à l'accès
        </Button>
      </div>
    );
  }

  const isDelivered = gallery.status === 'delivered';
  const isExpired = gallery.status === 'expired';
  const isProcessing = gallery.status === 'processing';
  const selectionLocked = isProcessing || isDelivered || isExpired;

  return (
    <div className="min-h-screen bg-ink-950">
      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
          <Logo size="sm" />
          <div className="text-right">
            <p className="font-display text-lg text-cream">{gallery.title}</p>
            <p className="text-xs text-muted">{gallery.client_name}</p>
          </div>
        </div>
      </header>

      {/* Bannières de statut */}
      {isProcessing && (
        <div className="border-b border-blue-800/30 bg-blue-900/15 px-5 py-3 text-center text-sm text-blue-300 md:px-10">
          Votre sélection a été validée. Les photos retouchées sont en préparation — vous recevrez un email dès qu'elles seront prêtes.
        </div>
      )}
      {isDelivered && (
        <div className="border-b border-emerald-800/30 bg-emerald-900/15 px-5 py-3 text-center text-sm text-emerald-300 md:px-10">
          Vos photos retouchées ont été livrées. Vérifiez votre email pour les liens de téléchargement — disponibles pendant 30 jours.
        </div>
      )}
      {isExpired && (
        <div className="border-b border-ink-600 bg-ink-900 px-5 py-3 text-center text-sm text-muted md:px-10">
          Cette galerie a expiré. La période de téléchargement est terminée.
        </div>
      )}

      {/* Barre d'info */}
      <div className="mx-auto max-w-7xl px-5 pt-8 md:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-cream sm:text-4xl">{gallery.title}</h1>
            <p className="mt-1.5 text-sm text-muted">
              {grid.name} · {grid.included_photos} photos incluses
            </p>
          </div>
          {!selectionLocked && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Sparkles size={15} className="text-sand-300" />
              Touchez le cœur pour sélectionner vos préférées
            </div>
          )}
        </div>
      </div>

      {/* Grille de photos */}
      {photos.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-10">
          <p className="text-sm text-muted">Aucune photo dans cette galerie.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-8 md:px-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo, idx) => {
              const isSelected = selectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-ink-800 transition-all duration-300 ${
                    isSelected ? 'border-sand-300/70 ring-1 ring-sand-300/30' : 'border-ink-700'
                  }`}
                  onClick={() => openLightbox(idx)}
                >
                  <img
                    src={photoUrl(photo.file_path)}
                    alt={photo.filename}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent opacity-60" />

                  {!selectionLocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(photo.id);
                      }}
                      className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition-all ${
                        isSelected
                          ? 'bg-sand-300 text-ink-950 scale-100'
                          : 'bg-ink-950/60 text-cream opacity-0 group-hover:opacity-100 hover:bg-ink-950/80'
                      }`}
                    >
                      {isSelected ? <Check size={16} /> : <Heart size={16} />}
                    </button>
                  )}

                  {isSelected && (
                    <div className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-sand-300 text-[10px] font-bold text-ink-950">
                      <Check size={12} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre de sélection flottante */}
      {!selectionLocked && photos.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 animate-slideUp">
          <div className="mx-auto mb-5 max-w-2xl px-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-ink-600 bg-ink-900/95 px-5 py-4 shadow-2xl backdrop-blur">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-cream">
                  {selectedCount} / {grid.included_photos} sélectionnées
                </span>
                {pricing.extraCount > 0 ? (
                  <span className="text-xs text-sand-300">
                    {pricing.extraCount} suppl. · +{formatEuro(pricing.extraCost)}
                  </span>
                ) : (
                  <span className="text-xs text-muted">
                    {selectedCount <= grid.included_photos
                      ? `${grid.included_photos - selectedCount} restantes incluses`
                      : 'Dans le quota inclus'}
                  </span>
                )}
              </div>
              <Button
                onClick={onValidate}
                loading={checkoutLoading}
                disabled={selectedCount === 0}
                size="md"
              >
                {pricing.total === 0 ? (
                  <>
                    <Check size={15} /> Valider (Gratuit)
                  </>
                ) : (
                  <>
                    <CreditCard size={15} /> Payer {formatEuro(pricing.total)}
                  </>
                )}
              </Button>
            </div>
            {checkoutError && (
              <p className="mb-2 rounded-lg border border-red-800/40 bg-red-900/30 px-3 py-2 text-xs text-red-300">
                {checkoutError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Visionneuse plein écran */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/95 animate-fadeIn"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
          >
            <X size={22} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="absolute left-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="absolute right-5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photoUrl(photos[lightboxIndex].file_path)}
              alt={photos[lightboxIndex].filename}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-display text-3xl text-cream/10 tracking-widest2 sm:text-5xl">
                Déclic Studio
              </span>
            </div>
          </div>

          {!selectionLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSelect(photos[lightboxIndex].id);
              }}
              className={`absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all ${
                selectedIds.has(photos[lightboxIndex].id)
                  ? 'bg-sand-300 text-ink-950'
                  : 'bg-ink-800 text-cream border border-ink-600 hover:bg-ink-700'
              }`}
            >
              {selectedIds.has(photos[lightboxIndex].id) ? (
                <>
                  <Check size={16} /> Sélectionnée
                </>
              ) : (
                <>
                  <Heart size={16} /> Sélectionner cette photo
                </>
              )}
            </button>
          )}

          <div className="absolute bottom-8 right-8 z-10 rounded-full bg-ink-900/80 px-3 py-1.5 text-xs text-muted">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}

      {!selectionLocked && photos.length > 0 && <div className="h-32" />}
    </div>
  );
}
