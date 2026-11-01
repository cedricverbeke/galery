import { useEffect, useState } from 'react';
import { Fragment } from 'react';
import { Plus, Images, ArrowRight, Inbox, KeyRound, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Gallery } from '@/types';
import { STATUS_LABELS } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { navigate } from '@/lib/router';
import { deleteGalleries } from '@/lib/deleteGalleries';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { AdminLayout } from './AdminLayout';

interface GalleryRow extends Gallery {
  photo_count: number;
  selected_count: number;
  selected_filenames: string[];
}

export function AdminDashboard() {
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = galleries.length > 0 && selected.size === galleries.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(galleries.map((g) => g.id)));

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const { deleted, errors } = await deleteGalleries([...selected]);
    setGalleries((prev) => prev.filter((g) => !deleted.includes(g.id)));
    setSelected(new Set(errors.map((e) => e.id)));
    setDeleting(false);
    if (errors.length > 0) {
      setDeleteError(
        `${errors.length} galerie${errors.length > 1 ? 's n\'ont' : ' n\'a'} pas pu être supprimée${errors.length > 1 ? 's' : ''} : ${errors[0].message}`,
      );
    } else {
      setConfirmOpen(false);
    }
  };
  const selectedRows = galleries.filter((g) => selected.has(g.id));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('galleries')
        .select('*, pricing_grid:pricing_grids(*)')
        .order('created_at', { ascending: false });
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const rows: GalleryRow[] = [];
      for (const g of data ?? []) {
        const { count: photoCount } = await supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('gallery_id', g.id)
          .eq('type', 'preview');
        const { data: selectedPhotos } = await supabase
          .from('photos')
          .select('filename')
          .eq('gallery_id', g.id)
          .eq('is_selected', true);
        rows.push({
          ...(g as Gallery),
          photo_count: photoCount ?? 0,
          selected_count: selectedPhotos?.length ?? 0,
          selected_filenames: (selectedPhotos ?? []).map((p) => p.filename),
        });
      }
      setGalleries(rows);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-cream">Galeries</h1>
          <p className="mt-1 text-sm text-muted">Suivez chaque galerie cliente, de la sélection à la livraison.</p>
        </div>
        <Button onClick={() => navigate('/admin/new-gallery')}>
          <Plus size={16} /> Nouvelle galerie
        </Button>
      </div>

      {/* Statistiques */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['selection_pending', 'processing', 'delivered', 'expired'] as const).map((s) => {
          const count = galleries.filter((g) => g.status === s).length;
          return (
            <div key={s} className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted">
                  {STATUS_LABELS[s]}
                </span>
                <StatusBadge status={s} />
              </div>
              <p className="mt-3 font-display text-3xl font-medium text-cream">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Liste des galeries */}
      {loading ? (
        <div className="mt-10 py-20"><Spinner size="lg" /></div>
      ) : galleries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 py-20 text-center">
          <Inbox size={32} className="text-muted" />
          <p className="mt-4 text-sm text-muted">Aucune galerie pour le moment.</p>
          <Button onClick={() => navigate('/admin/new-gallery')} variant="outline" className="mt-5">
            <Plus size={16} /> Créer votre première galerie
          </Button>
        </div>
      ) : (
        <>
        {selected.size > 0 && (
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-sand-300/30 bg-ink-900 px-5 py-3">
            <span className="text-sm text-cream">
              {selected.size} galerie{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                <X size={14} /> Désélectionner
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
              >
                <Trash2 size={14} /> Supprimer
              </Button>
            </div>
          </div>
        )}
        <div className={`${selected.size > 0 ? 'mt-4' : 'mt-8'} overflow-hidden rounded-2xl border border-ink-700`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-700 bg-ink-900/60 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-5 py-3.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Tout sélectionner"
                    className="h-4 w-4 cursor-pointer accent-[#d9c3a0]"
                  />
                </th>
                <th className="px-5 py-3.5 font-medium">Client</th>
                <th className="hidden px-5 py-3.5 font-medium md:table-cell">Code</th>
                <th className="hidden px-5 py-3.5 font-medium md:table-cell">Photos</th>
                <th className="hidden px-5 py-3.5 font-medium md:table-cell">Sélectionnées</th>
                <th className="px-5 py-3.5 font-medium">Statut</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {galleries.map((g) => {
                const isExpanded = expanded === g.id;
                const hasSelection = g.selected_count > 0;
                return (
                  <Fragment key={g.id}>
                    <tr
                      onClick={() => navigate(`/admin/gallery/${g.id}`)}
                      className={`cursor-pointer transition-colors hover:bg-ink-900/60 ${selected.has(g.id) ? 'bg-ink-900/60' : ''}`}
                    >
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(g.id)}
                          onChange={() => toggleOne(g.id)}
                          aria-label={`Sélectionner ${g.client_name}`}
                          className="h-4 w-4 cursor-pointer accent-[#d9c3a0]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-cream">{g.client_name}</div>
                        <div className="text-xs text-muted">{g.title} · {g.client_email}</div>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1 font-mono text-xs text-sand-300">
                          <KeyRound size={12} /> {g.access_code}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <span className="flex items-center gap-1.5 text-muted">
                          <Images size={14} /> {g.photo_count}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        {hasSelection ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(isExpanded ? null : g.id);
                            }}
                            className="text-sand-300 transition-colors hover:text-sand-200"
                          >
                            {g.selected_count} photo{g.selected_count > 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={g.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <ArrowRight size={16} className="text-muted" />
                      </td>
                    </tr>
                    {isExpanded && hasSelection && (
                      <tr className="bg-ink-900/40">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="rounded-xl border border-ink-700 bg-ink-950/60 p-4">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-sand-300">
                              Photos sélectionnées par le client
                            </p>
                            <p className="text-sm text-cream break-words">
                              {g.selected_filenames.join('  ')}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <ConfirmDeleteModal
        open={confirmOpen}
        count={selected.size}
        label={selectedRows.length === 1 ? `${selectedRows[0].client_name} — ${selectedRows[0].title}` : undefined}
        loading={deleting}
        error={deleteError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  );
}
