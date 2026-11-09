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
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { supabase, PREVIEW_BUCKET } from '@/lib/supabase';
import type { Gallery, PricingGrid, Photo } from '@/types';
import { calculateExtraPrice } from '@/types';
import { formatEuro } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { navigate } from '@/lib/router';

type PhotoComment = { id: string; comment_text: string; created_at: string };
type PhotoRow = Photo & { photo_comments?: PhotoComment[] };

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
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, PhotoComment>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

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
      .select('*, photo_comments(id, comment_text, created_at)')
      .eq('gallery_id', id)
      .eq('type', 'preview')
      .order('created_at', { ascending: true });

    const grid = (gal as Gallery & { pricing_grid: PricingGrid }).pricing_grid;
    const photoRows = (photos ?? []) as PhotoRow[];
    const commentsMap: Record<string, PhotoComment> = {};
    for (const p of photoRows) {
      if (p.photo_comments && p.photo_comments.length > 0) {
        // une seule remarque par photo : on garde la plus récente
        commentsMap[p.id] = [...p.photo_comments].sort((x, y) =>
          x.created_at.localeCompare(y.created_at),
        )[p.photo_comments.length - 1];
      }
    }
    setCommentsByPhoto(commentsMap);
    setData({
      gallery: gal as Gallery,
      pricing_grid: grid,
      preview_photos: photoRows,
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

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setCommentsOpen(false);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length));
  const prevPhoto = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));

  // À chaque changement de photo, le champ est prérempli avec la remarque existante
  useEffect(() => {
    if (lightboxIndex === null) return;
    const ph = photos[lightboxIndex];
    setCommentDraft(ph ? commentsByPhoto[ph.id]?.comment_text ?? '' : '');
    setCommentError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex]);

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

  // Une seule remarque par photo : on supprime l'ancienne puis on insère la nouvelle
  const submitComment = async () => {
    if (lightboxIndex === null || !gallery) return;
    const photo = photos[lightboxIndex];
    if (!photo) return;
    const text = commentDraft.trim();
    if (!text) return;

    setCommentSaving(true);
    setCommentError(null);

    if (commentsByPhoto[photo.id]) {
      const { error: delErr } = await supabase
        .from('photo_comments')
        .delete()
        .eq('photo_id', photo.id);
      if (delErr) {
        setCommentSaving(false);
        setCommentError("Impossible d'enregistrer la remarque.");
        return;
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('photo_comments')
      .insert({
        photo_id: photo.id,
        gallery_id: gallery.id,
        comment_text: text,
      })
      .select('id, comment_text, created_at')
      .single();
    setCommentSaving(false);

    if (insErr || !inserted) {
      setCommentError("Impossible d'enregistrer la remarque.");
      // l'ancienne remarque a pu être supprimée : on la retire aussi de l'affichage
      setCommentsByPhoto((prev) => {
        const next = { ...prev };
        delete next[photo.id];
        return next;
      });
      return;
    }
    setCommentsByPhoto((prev) => ({ ...prev, [photo.id]: inserted as PhotoComment }));
    setCommentDraft((inserted as PhotoComment).comment_text);
  };

  const deleteComment = async (photoId: string) => {
    setCommentSaving(true);
    setCommentError(null);
    const { error: delErr } = await supabase
      .from('photo_comments')
      .delete()
      .eq('photo_id', photoId);
    setCommentSaving(false);
    if (delErr) {
      setCommentError('Impossible de supprimer la remarque.');
      return;
    }
    setCommentsByPhoto((prev) => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
    setCommentDraft('');
  };

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
                          : 'bg-ink-950/60 text-cream hover:bg-ink-950/80'
                      }`}
                    >
                      {isSelected ? <Check size={16} /> : <Heart size={16} />}
                    </button>
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

      {/* Visionneuse plein écran : la photo occupe la zone du haut, la barre d'actions est en dessous (rien ne la recouvre) */}
      {lightboxIndex !== null && photos[lightboxIndex] && (() => {
        const currentPhoto = photos[lightboxIndex];
        const remark = commentsByPhoto[currentPhoto.id];
        const draftIsSaved = !!remark && commentDraft.trim() === remark.comment_text;
        const isCurrentSelected = selectedIds.has(currentPhoto.id);
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 animate-fadeIn"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-ink-950/50 text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
            >
              <X size={22} />
            </button>

            {/* Zone photo */}
            <div className="relative min-h-0 flex-1">
              <img
                src={photoUrl(currentPhoto.file_path)}
                alt={currentPhoto.filename}
                className="absolute inset-0 h-full w-full object-contain p-3 sm:p-6"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-display text-3xl text-cream/10 tracking-widest2 sm:text-5xl">
                  Déclic Studio
                </span>
              </div>

              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      prevPhoto();
                    }}
                    className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/50 text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nextPhoto();
                    }}
                    className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/50 text-cream/70 transition-colors hover:bg-ink-800 hover:text-cream"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {/* Barre d'actions sous la photo */}
            <div
              className="z-20 shrink-0 border-t border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur"
              onClick={(e) => e.stopPropagation()}
            >
              {commentsOpen && (
                <div className="mx-auto mb-3 flex w-full max-w-xl flex-col gap-2">
                  <label className="text-xs font-medium text-cream/80">
                    Remarque pour cette photo
                  </label>

                  {!selectionLocked ? (
                    <>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Ex. : retouche, cadrage, recadrer à gauche…"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-cream placeholder:text-muted focus:border-sand-300/50 focus:outline-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted">
                          {remark && draftIsSaved ? 'Remarque enregistrée' : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          {remark && (
                            <button
                              onClick={() => deleteComment(currentPhoto.id)}
                              disabled={commentSaving}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted transition-colors hover:text-red-300 disabled:opacity-40"
                            >
                              <Trash2 size={13} /> Supprimer
                            </button>
                          )}
                          <button
                            onClick={submitComment}
                            disabled={commentSaving || !commentDraft.trim() || draftIsSaved}
                            className="flex items-center gap-1.5 rounded-lg bg-sand-300 px-3 py-1.5 text-xs font-medium text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {commentSaving ? <Spinner size="sm" /> : <Send size={13} />}
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </>
                  ) : remark ? (
                    <p className="whitespace-pre-wrap break-words rounded-lg bg-ink-800/60 p-3 text-sm text-cream">
                      {remark.comment_text}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">Aucune remarque pour cette photo.</p>
                  )}

                  {commentError && <p className="text-xs text-red-300">{commentError}</p>}
                </div>
              )}

              <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
                <span className="w-12 text-xs text-muted">
                  {lightboxIndex + 1} / {photos.length}
                </span>

                {!selectionLocked ? (
                  <button
                    onClick={() => toggleSelect(currentPhoto.id)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      isCurrentSelected
                        ? 'bg-sand-300 text-ink-950'
                        : 'border border-ink-600 bg-ink-800 text-cream hover:bg-ink-700'
                    }`}
                  >
                    {isCurrentSelected ? (
                      <>
                        <Check size={16} /> Sélectionnée
                      </>
                    ) : (
                      <>
                        <Heart size={16} /> Sélectionner
                      </>
                    )}
                  </button>
                ) : (
                  <span />
                )}

                <button
                  onClick={() => setCommentsOpen((o) => !o)}
                  className={`flex w-12 items-center justify-end gap-1.5 text-sm transition-colors ${
                    commentsOpen ? 'text-sand-300' : 'text-cream/70 hover:text-cream'
                  }`}
                  title="Remarque"
                >
                  <MessageSquare size={18} />
                  {remark && <span className="h-2 w-2 rounded-full bg-sand-300" />}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {!selectionLocked && photos.length > 0 && <div className="h-32" />}
    </div>
  );
}
