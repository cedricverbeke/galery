import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase, PREVIEW_BUCKET } from '@/lib/supabase';
import type { PricingGrid } from '@/types';
import { compressAndWatermark } from '@/lib/image';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';
import { navigate } from '@/lib/router';
import { AdminLayout } from './AdminLayout';

interface UploadItem {
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function NewGalleryPage() {
  const [grids, setGrids] = useState<PricingGrid[]>([]);
  const [loadingGrids, setLoadingGrids] = useState(true);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [accessCode, setAccessCode] = useState(randomCode());
  const [gridId, setGridId] = useState('');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('pricing_grids').select('*').order('name');
      setGrids(data ?? []);
      if (data && data.length > 0) setGridId(data[0].id);
      setLoadingGrids(false);
    })();
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setItems((prev) => [...prev, ...arr.map((file) => ({ file, status: 'pending' as const }))]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const createGallery = async () => {
    setError(null);
    if (!title.trim() || !clientName.trim() || !clientEmail.trim() || !accessCode.trim() || !gridId) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    if (items.length === 0) {
      setError('Ajoutez au moins une photo à téléverser.');
      return;
    }
    setCreating(true);

    const { data: gal, error: galErr } = await supabase
      .from('galleries')
      .insert({
        title: title.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        access_code: accessCode.trim(),
        pricing_grid_id: gridId,
        status: 'selection_pending',
      })
      .select()
      .single();
    if (galErr) {
      setError(galErr.message);
      setCreating(false);
      return;
    }

    let successCount = 0;
    for (let i = 0; i < items.length; i++) {
      setItems((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing' };
        return next;
      });
      try {
        const item = items[i];
        const { blob } = await compressAndWatermark(item.file);
        const ext = 'jpg';
        const filename = `${String(i + 1).padStart(3, '0')}-${Date.now()}.${ext}`;
        const path = `${gal.id}/${filename}`;
        const { error: upErr } = await supabase.storage
          .from(PREVIEW_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        const { error: phErr } = await supabase.from('photos').insert({
          gallery_id: gal.id,
          type: 'preview',
          file_path: path,
          filename: item.file.name,
        });
        if (phErr) throw phErr;
        successCount++;
        setItems((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'done' };
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Échec du téléversement';
        setItems((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: msg };
          return next;
        });
      }
    }

    setCreating(false);
    if (successCount > 0) {
      navigate(`/admin/gallery/${gal.id}`);
    } else {
      setError('Tous les téléversements ont échoué. Veuillez réessayer.');
    }
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const processingCount = items.filter((i) => i.status === 'processing').length;

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/admin')}
        className="mb-6 flex items-center gap-2 text-sm text-muted transition-colors hover:text-cream"
      >
        <ArrowLeft size={16} /> Retour au tableau de bord
      </button>

      <h1 className="font-display text-3xl font-medium text-cream">Nouvelle galerie</h1>
      <p className="mt-1 text-sm text-muted">
        Créez une galerie cliente et téléversez les aperçus filigranés.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Formulaire */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <h2 className="font-display text-xl font-medium text-cream">Détails du client</h2>
            <div className="mt-5 flex flex-col gap-4">
              <Input
                label="Titre de la galerie"
                placeholder="Séance portrait de printemps"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                label="Nom du client"
                placeholder="Marie Dubois"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <Input
                label="Email du client"
                type="email"
                placeholder="marie@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <Input
                label="Code d'accès"
                hint="Le client saisira ce code pour voir sa galerie."
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted">
                  Grille tarifaire
                </label>
                {loadingGrids ? (
                  <Spinner size="sm" />
                ) : (
                  <select
                    value={gridId}
                    onChange={(e) => setGridId(e.target.value)}
                    className="w-full rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-sand-300/30"
                  >
                    {grids.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Téléversement */}
        <div className="lg:col-span-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-14 transition-all ${
              dragOver
                ? 'border-sand-300/60 bg-sand-300/5'
                : 'border-ink-600 hover:border-ink-500 hover:bg-ink-900/40'
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-sand-300">
              <Upload size={22} />
            </div>
            <p className="mt-4 text-sm font-medium text-cream">Glissez-déposez vos photos ici</p>
            <p className="mt-1 text-xs text-muted">ou cliquez pour parcourir — JPEG, PNG, WEBP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {items.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted">
                  {items.length} photos · {doneCount} terminées
                </span>
                {processingCount > 0 && <Spinner size="sm" />}
              </div>
              <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-ink-700 bg-ink-800"
                  >
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <ImageIcon size={20} />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 truncate bg-ink-950/80 px-2 py-1 text-[10px] text-cream">
                      {item.file.name}
                    </div>
                    {item.status === 'done' && (
                      <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/90 text-white">
                        <Check size={13} />
                      </div>
                    )}
                    {item.status === 'processing' && (
                      <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/90">
                        <Spinner size="sm" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-white" title={item.error}>
                        <AlertCircle size={13} />
                      </div>
                    )}
                    {!creating && item.status !== 'processing' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(i);
                        }}
                        className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-950/80 text-muted opacity-0 transition-opacity hover:text-cream group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2.5 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <Button onClick={createGallery} loading={creating} size="lg" disabled={items.length === 0}>
              Créer la galerie et téléverser {items.length > 0 ? `(${items.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
