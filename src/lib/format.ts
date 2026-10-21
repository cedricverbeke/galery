import type { PricingGrid } from '@/types';

/** Formate un montant en euros. */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const STATUS_LABELS: Record<string, string> = {
  selection_pending: 'Sélection en attente',
  processing: 'En traitement',
  delivered: 'Livré',
  expired: 'Expiré',
};

export const STATUS_COLORS: Record<string, string> = {
  selection_pending: 'text-sand-300 bg-sand-300/10 border-sand-300/20',
  processing: 'text-blue-300 bg-blue-300/10 border-blue-300/20',
  delivered: 'text-emerald-300 bg-emerald-300/10 border-emerald-300/20',
  expired: 'text-muted bg-muted/10 border-muted/20',
};

export function gridSummary(grid: PricingGrid): string {
  const tiers = grid.tiered_pricing ?? [];
  if (tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    return `${grid.included_photos} incluses · dès ${formatEuro(sorted[0].price)}/suppl.`;
  }
  return `${grid.included_photos} incluses · ${formatEuro(grid.base_extra_price)}/suppl.`;
}
