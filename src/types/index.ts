export type GalleryStatus = 'selection_pending' | 'processing' | 'delivered' | 'expired';
export type PhotoType = 'preview' | 'final_hd';

export interface TierRule {
  min: number;
  price: number;
}

export interface PricingGrid {
  id: string;
  name: string;
  included_photos: number;
  base_extra_price: number;
  tiered_pricing: TierRule[] | null;
  created_at?: string;
}

export interface Gallery {
  id: string;
  title: string;
  client_name: string;
  client_email: string;
  access_code: string;
  pricing_grid_id: string;
  status: GalleryStatus;
  selection_validated_at: string | null;
  delivered_at: string | null;
  deletion_scheduled_at: string | null;
  created_at?: string;
  pricing_grid?: PricingGrid;
}

export interface Photo {
  id: string;
  gallery_id: string;
  type: PhotoType;
  file_path: string;
  filename: string;
  is_selected: boolean;
  created_at?: string;
}

export interface GalleryWithDetails extends Gallery {
  pricing_grid: PricingGrid;
  photos: Photo[];
}

/** Calculate the extra cost for a selection count against a pricing grid. */
export function calculateExtraPrice(
  grid: Pick<PricingGrid, 'included_photos' | 'base_extra_price' | 'tiered_pricing'>,
  selectedCount: number,
): { extraCount: number; extraCost: number; total: number } {
  const extraCount = Math.max(0, selectedCount - grid.included_photos);
  if (extraCount === 0) {
    return { extraCount: 0, extraCost: 0, total: 0 };
  }
  let unitPrice = grid.base_extra_price;
  const tiers = grid.tiered_pricing ?? [];
  if (tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.min - a.min);
    const applicable = sorted.find((t) => extraCount >= t.min);
    if (applicable) {
      unitPrice = applicable.price;
    }
  }
  const extraCost = extraCount * unitPrice;
  return { extraCount, extraCost, total: extraCost };
}
