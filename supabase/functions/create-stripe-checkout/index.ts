import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CheckoutBody {
  gallery_id: string;
  selected_photo_ids: string[];
  free_validation?: boolean;
}

interface PricingGrid {
  id: string;
  name: string;
  included_photos: number;
  base_extra_price: number;
  tiered_pricing: { min: number; price: number }[] | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CheckoutBody = await req.json();
    const { gallery_id, selected_photo_ids, free_validation } = body;

    if (!gallery_id || !selected_photo_ids || selected_photo_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing gallery_id or selected_photo_ids' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch gallery + pricing grid
    const { data: gallery, error: galErr } = await supabase
      .from('galleries')
      .select('*, pricing_grid:pricing_grids(*)')
      .eq('id', gallery_id)
      .maybeSingle();

    if (galErr || !gallery) {
      return new Response(
        JSON.stringify({ error: 'Gallery not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (gallery.status !== 'selection_pending') {
      return new Response(
        JSON.stringify({ error: 'Selection already validated for this gallery' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const grid = gallery.pricing_grid as PricingGrid;
    const selectedCount = selected_photo_ids.length;
    const extraCount = Math.max(0, selectedCount - grid.included_photos);

    // Calculate price
    let extraCost = 0;
    if (extraCount > 0) {
      let unitPrice = Number(grid.base_extra_price);
      const tiers = grid.tiered_pricing ?? [];
      if (tiers.length > 0) {
        const sorted = [...tiers].sort((a, b) => b.min - a.min);
        const applicable = sorted.find((t) => extraCount >= t.min);
        if (applicable) {
          unitPrice = Number(applicable.price);
        }
      }
      extraCost = extraCount * unitPrice;
    }

    // Free validation path (selection within included quota)
    if (extraCost === 0 || free_validation) {
      const { error: photoErr } = await supabase
        .from('photos')
        .update({ is_selected: true })
        .in('id', selected_photo_ids);

      if (photoErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to update photo selection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { error: galUpdErr } = await supabase
        .from('galleries')
        .update({
          status: 'processing',
          selection_validated_at: new Date().toISOString(),
        })
        .eq('id', gallery_id);

      if (galUpdErr) {
        return new Response(
          JSON.stringify({ error: 'Failed to update gallery status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Fetch filenames for photographer email
      const { data: selectedRows } = await supabase
        .from('photos')
        .select('filename')
        .in('id', selected_photo_ids);
      const selectedFilenames = (selectedRows ?? []).map((p) => p.filename);

      // Notify photographer (best-effort)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-delivery-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'photographer_selection_notice',
            gallery_id,
            client_name: gallery.client_name,
            client_email: gallery.client_email,
            selected_filenames: selectedFilenames,
          }),
        });
      } catch {
        // best-effort
      }

      return new Response(
        JSON.stringify({ status: 'validated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Paid path — create Stripe Checkout
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const origin = req.headers.get('origin') ?? 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: extraCount,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(extraCost / extraCount * 100),
            product_data: {
              name: `Photos supplémentaires — ${grid.name}`,
              description: `${extraCount} photo${extraCount > 1 ? 's' : ''} au-delà des ${grid.included_photos} incluses dans votre forfait.`,
            },
          },
        },
      ],
      metadata: {
        gallery_id,
        selected_photo_ids: selected_photo_ids.join(','),
        client_name: gallery.client_name,
        client_email: gallery.client_email,
      },
      success_url: `${origin}/#/gallery/${gallery_id}?status=paid`,
      cancel_url: `${origin}/#/gallery/${gallery_id}?status=cancelled`,
      customer_email: gallery.client_email,
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
