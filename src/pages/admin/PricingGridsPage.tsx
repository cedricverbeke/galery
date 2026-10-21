import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, Pencil, Tag, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PricingGrid, TierRule } from '@/types';
import { formatEuro, gridSummary } from '@/lib/format';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { AdminLayout } from './AdminLayout';

export function PricingGridsPage() {
  const [grids, setGrids] = useState<PricingGrid[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PricingGrid | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pricing_grids')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setGrids(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setShowEditor(true);
  };
  const openEdit = (g: PricingGrid) => {
    setEditing(g);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette grille tarifaire ?')) return;
    const { error } = await supabase.from('pricing_grids').delete().eq('id', id);
    if (error) {
      alert(error.message);
    } else {
      setGrids((g) => g.filter((x) => x.id !== id));
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-cream">Grilles tarifaires</h1>
          <p className="mt-1 text-sm text-muted">
            Définissez le nombre de photos incluses et le prix des suppléments.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Nouvelle grille
        </Button>
      </div>

      {loading ? (
        <div className="py-20"><Spinner size="lg" /></div>
      ) : grids.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 py-20 text-center">
          <Tag size={32} className="text-muted" />
          <p className="mt-4 text-sm text-muted">Aucune grille tarifaire.</p>
          <Button onClick={openNew} variant="outline" className="mt-5">
            <Plus size={16} /> Créer votre première grille
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grids.map((g) => (
            <div
              key={g.id}
              className="group rounded-2xl border border-ink-700 bg-ink-900 p-6 transition-all hover:border-sand-300/30"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-display text-xl font-medium text-cream">{g.name}</h3>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(g)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-ink-800 hover:text-cream"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-900/30 hover:text-red-300"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-sand-300">{gridSummary(g)}</p>

              <div className="mt-5 space-y-2 border-t border-ink-700 pt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Photos incluses</span>
                  <span className="text-cream">{g.included_photos}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Prix de base suppl.</span>
                  <span className="text-cream">{formatEuro(Number(g.base_extra_price))}</span>
                </div>
                {g.tiered_pricing && g.tiered_pricing.length > 0 && (
                  <div className="pt-1">
                    <span className="text-muted text-xs">Paliers</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[...g.tiered_pricing]
                        .sort((a, b) => a.min - b.min)
                        .map((t, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-ink-600 bg-ink-800 px-2 py-0.5 text-[10px] text-muted"
                          >
                            {t.min}+ → {formatEuro(t.price)}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <PricingGridEditor
          grid={editing}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            setShowEditor(false);
            load();
          }}
        />
      )}
    </AdminLayout>
  );
}

interface EditorProps {
  grid: PricingGrid | null;
  onClose: () => void;
  onSaved: () => void;
}

function PricingGridEditor({ grid, onClose, onSaved }: EditorProps) {
  const [name, setName] = useState(grid?.name ?? '');
  const [included, setIncluded] = useState(String(grid?.included_photos ?? 10));
  const [basePrice, setBasePrice] = useState(String(grid?.base_extra_price ?? 15));
  const [tiers, setTiers] = useState<TierRule[]>(grid?.tiered_pricing ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTier = () => setTiers([...tiers, { min: 5, price: 10 }]);
  const updateTier = (i: number, field: keyof TierRule, value: string) => {
    const next = [...tiers];
    next[i] = { ...next[i], [field]: Number(value) };
    setTiers(next);
  };
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      included_photos: Number(included),
      base_extra_price: Number(basePrice),
      tiered_pricing: tiers.length > 0 ? tiers : null,
    };

    if (!payload.name || payload.included_photos < 0 || payload.base_extra_price < 0) {
      setError('Veuillez remplir tous les champs avec des valeurs valides.');
      setSaving(false);
      return;
    }

    const { error } = grid
      ? await supabase.from('pricing_grids').update(payload).eq('id', grid.id)
      : await supabase.from('pricing_grids').insert(payload);

    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      onSaved();
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-xl">
      <form onSubmit={onSubmit} className="p-7">
        <h2 className="font-display text-2xl font-medium text-cream">
          {grid ? 'Modifier la grille' : 'Nouvelle grille tarifaire'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Configurez les photos incluses et la tarification des suppléments.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Input
            label="Nom de la grille"
            required
            placeholder="Portrait Standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Photos incluses"
              type="number"
              min={0}
              required
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
            />
            <Input
              label="Prix suppl. de base (€)"
              type="number"
              min={0}
              step="0.5"
              required
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-muted">
                Tarification par paliers (optionnel)
              </label>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1 text-xs text-sand-300 hover:text-sand-200"
              >
                <Plus size={13} /> Ajouter un palier
              </button>
            </div>
            <p className="mb-3 mt-1 text-xs text-muted">
              Proposez des remises volume : si le client sélectionne ≥ « min » photos supplémentaires, le prix indiqué s'applique par photo.
            </p>

            {tiers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-xs text-muted">
                Aucun palier — le prix de base s'applique à chaque photo supplémentaire.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-xs text-muted">≥</span>
                      <input
                        type="number"
                        min={1}
                        value={t.min}
                        onChange={(e) => updateTier(i, 'min', e.target.value)}
                        className="w-20 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-sand-300/30"
                        placeholder="min"
                      />
                      <span className="text-xs text-muted">suppl. →</span>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={t.price}
                          onChange={(e) => updateTier(i, 'price', e.target.value)}
                          className="w-full rounded-lg border border-ink-600 bg-ink-800 pl-7 pr-3 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-sand-300/30"
                          placeholder="prix"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-red-900/30 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="mt-7 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            <Save size={15} /> {grid ? 'Enregistrer' : 'Créer la grille'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
