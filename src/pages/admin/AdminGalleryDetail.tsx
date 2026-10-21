import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  Check,
  Send,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { supabase, PREVIEW_BUCKET, FINAL_HD_BUCKET } from '@/lib/supabase';
import type { Gallery, PricingGrid, Photo } from '@/types';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Spinner } from '@/components/Spinner';
import { navigate } from '@/lib/router';
import { AdminLayout } from './AdminLayout';

interface GalleryDetail {
  gallery: Gallery;
  pricing_grid: PricingGrid;
  photos: Photo[];
}

export function AdminGalleryDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hdItems, setHdItems] = useState<{ filename: string; status: 'uploading' | 'done' | 'error' }[]>([]);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const hdInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_get_gallery_full', { p_gallery_id: id });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data || data.error === 'not_found') {
      setError('Galerie introuvable.');
      setLoading(false);
      return;
    }
    setDetail(data as GalleryDetail);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const previewPhotos = detail?.photos.filter((p) => p.type === 'preview') ?? [];
  const finalPhotos = detail?.photos.filter((p) => p.type === 'final_hd') ?? [];
  const selectedPhotos = previewPhotos.filter((p) => p.is_selected);

  const uploadHd = async (files: File[]) => {
    if (!detail) return;
    const galId = detail.gallery.id;
    const newItems = files.map((f) => ({ filename: f.name, status: 'uploading' as const }));
    setHdItems((prev) => [...prev, ...newItems]);
    const startIdx = hdItems.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const idx = startIdx + i;
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const filename = `${String(idx + 1).padStart(3, '0')}-${Date.now()}.${ext}`;
        const path = `${galId}/${filename}`;
        const { error: upErr } = await supabase.storage
          .from(FINAL_HD_BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { error: phErr } = await supabase.from('photos').insert({
          gallery_id: galId,
          type: 'final_hd',
          file_path: path,
          filename: file.name,
        });
        if (phErr) throw phErr;
        setHdItems((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'done' };
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Échec du téléversement';
        setHdItems((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'error', filename: `${file.name}: ${msg}` };
          return next;
        });
      }
    }
    load();
  };

  const onHdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadHd(Array.from(e.target.files).filter((f) => f.type.startsWith('image/')));
    }
    e.target.value = '';
  };

  const removeFinal = async (photo: Photo) => {
    if (!confirm(`Supprimer ${photo.filename} des photos HD ?`)) return;
    await supabase.storage.from(FINAL_HD_BUCKET).remove([photo.file_path]);
    await supabase.from('photos').delete().eq('id', photo.id);
    load();
  };

  const sendDelivery = async () => {
    if (!detail) return;
    if (finalPhotos.length === 0) {
      alert('Téléversez au moins une photo retouchée avant d\'envoyer.');
      return;
    }
    if (!confirm(`Envoyer la galerie finale à ${detail.gallery.client_name} ? Un email sera envoyé au client et tous les aperçus seront supprimés.`)) return;
    setSending(true);

    const now = new Date().toISOString();
    const deletionAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await supabase
      .from('galleries')
      .update({
        status: 'delivered',
        delivered_at: now,
        deletion_scheduled_at: deletionAt,
      })
      .eq('id', detail.gallery.id);
    if (updErr) {
      alert(updErr.message);
      setSending(false);
      return;
    }

    const previewPaths = previewPhotos.map((p) => p.file_path);
    if (previewPaths.length > 0) {
      await supabase.storage.from(PREVIEW_BUCKET).remove(previewPaths);
    }
    await supabase.from('photos').delete().eq('gallery_id', detail.gallery.id).eq('type', 'preview');

    const { data: signedData } = await supabase.storage
      .from(FINAL_HD_BUCKET)
      .createSignedUrls(finalPhotos.map((p) => p.file_path), 60 * 60 * 24 * 30);

    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-delivery-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gallery_id: detail.gallery.id,
          client_name: detail.gallery.client_name,
          client_email: detail.gallery.client_email,
          download_urls: signedData?.map((s, i) => ({
            filename: finalPhotos[i].filename,
            url: s.signedUrl,
          })) ?? [],
        }),
      });
    } catch (err) {
      console.error('Email de livraison échoué :', err);
    }

    setSending(false);
    load();
  };

  const clientLink = `${window.location.origin}/#/access`;
  const copyLink = () => {
    navigator.clipboard.writeText(`${clientLink}/${detail?.gallery.access_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-20"><Spinner size="lg" /></div>
      </AdminLayout>
    );
  }
  if (error || !detail) {
    return (
      <AdminLayout>
        <p className="text-red-400">{error ?? 'Galerie introuvable.'}</p>
        <Button variant="ghost" onClick={() => navigate('/admin')} className="mt-4">
          <ArrowLeft size={16} /> Retour
        </Button>
      </AdminLayout>
    );
  }

  const g = detail.gallery;
  const isProcessing = g.status === 'processing';
  const isDelivered = g.status === 'delivered';
  const isExpired = g.status === 'expired';

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/admin')}
        className="mb-6 flex items-center gap-2 text-sm text-muted transition-colors hover:text-cream"
      >
        <ArrowLeft size={16} /> Retour au tableau de bord
      </button>

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-medium text-cream">{g.title}</h1>
            <StatusBadge status={g.status} />
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {g.client_name} · {g.client_email}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-sand-300">
              {clientLink}/{g.access_code}
            </code>
            <button
              onClick={copyLink}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-ink-800 hover:text-cream"
              title="Copier le lien client"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Photos sélectionnées à retoucher */}
        <section>
          <h2 className="font-display text-xl font-medium text-cream">
            Sélection du client
            {selectedPhotos.length > 0 && (
              <span className="ml-2 text-sm text-sand-300">({selectedPhotos.length})</span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isProcessing
              ? 'Le client a validé sa sélection. Retouchez ces photos et téléversez les versions HD ci-dessous.'
              : selectedPhotos.length > 0
                ? 'Photos marquées comme sélectionnées par le client.'
                : 'Le client n\'a pas encore validé sa sélection.'}
          </p>

          {selectedPhotos.length === 0 ? (
            <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 py-14 text-center">
              <ImageIcon size={28} className="text-muted" />
              <p className="mt-3 text-sm text-muted">Aucune photo sélectionnée pour l'instant.</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {selectedPhotos.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-sand-300/20 bg-ink-800"
                >
                  <img
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${p.file_path}`}
                    alt={p.filename}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 truncate bg-ink-950/80 px-2 py-1 text-[10px] text-cream">
                    {p.filename}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Téléversement HD + livraison */}
        <section>
          <h2 className="font-display text-xl font-medium text-cream">Photos HD retouchées</h2>
          <p className="mt-1 text-sm text-muted">
            Téléversez les versions finales retouchées en HD. Elles sont stockées en privé et partagées via des liens de téléchargement sécurisés.
          </p>

          {isExpired ? (
            <div className="mt-5 rounded-2xl border border-ink-600 bg-ink-900 p-8 text-center text-sm text-muted">
              Cette galerie a expiré. Les fichiers HD ont été automatiquement supprimés.
            </div>
          ) : (
            <>
              {isProcessing && (
                <div
                  onClick={() => hdInputRef.current?.click()}
                  className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-600 py-10 transition-colors hover:border-ink-500 hover:bg-ink-900/40"
                >
                  <Upload size={22} className="text-sand-300" />
                  <p className="mt-3 text-sm font-medium text-cream">Téléverser les photos HD retouchées</p>
                  <p className="mt-1 text-xs text-muted">Cliquez pour parcourir — résolution d'origine</p>
                  <input
                    ref={hdInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onHdSelect}
                  />
                </div>
              )}

              {hdItems.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {hdItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2.5 text-xs"
                    >
                      {item.status === 'uploading' && <Loader2 size={14} className="animate-spin text-sand-300" />}
                      {item.status === 'done' && <Check size={14} className="text-emerald-400" />}
                      {item.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
                      <span className={item.status === 'error' ? 'text-red-300' : 'text-cream'}>
                        {item.filename}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {finalPhotos.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {finalPhotos.map((p) => (
                    <div
                      key={p.id}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-ink-700 bg-ink-800"
                    >
                      <div className="flex h-full w-full items-center justify-center bg-ink-900 text-sand-300">
                        <ImageIcon size={22} />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 truncate bg-ink-950/80 px-2 py-1 text-[10px] text-cream">
                        {p.filename}
                      </div>
                      {!isDelivered && !isExpired && (
                        <button
                          onClick={() => removeFinal(p)}
                          className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/80 text-muted opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !isProcessing && (
                  <div className="mt-5 rounded-xl border border-dashed border-ink-600 px-4 py-8 text-center text-sm text-muted">
                    Aucune photo HD téléversée.
                  </div>
                )
              )}

              {isProcessing && finalPhotos.length > 0 && (
                <div className="mt-6">
                  <Button onClick={sendDelivery} loading={sending} size="lg" className="w-full">
                    <Send size={16} /> Envoyer la galerie finale au client
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted">
                    Envoie un email au client avec un lien de téléchargement valable 30 jours et supprime tous les aperçus.
                  </p>
                </div>
              )}

              {isDelivered && (
                <div className="mt-6 rounded-xl border border-emerald-800/30 bg-emerald-900/15 px-4 py-4 text-center">
                  <Check size={24} className="mx-auto text-emerald-400" />
                  <p className="mt-2 text-sm text-emerald-300">Galerie livrée au client.</p>
                  <p className="mt-1 text-xs text-muted">
                    Les liens expirent le {g.deletion_scheduled_at ? new Date(g.deletion_scheduled_at).toLocaleDateString('fr-FR') : 'dans 30 jours'}.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Tous les aperçus (référence) */}
      {previewPhotos.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-medium text-cream">
            Tous les aperçus ({previewPhotos.length})
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {previewPhotos.map((p) => (
              <div
                key={p.id}
                className={`group relative aspect-square overflow-hidden rounded-lg border bg-ink-800 ${
                  p.is_selected ? 'border-sand-300/50' : 'border-ink-700'
                }`}
              >
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${PREVIEW_BUCKET}/${p.file_path}`}
                  alt={p.filename}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {p.is_selected && (
                  <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-sand-300 text-ink-950">
                    <Check size={11} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
