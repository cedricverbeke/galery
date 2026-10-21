import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const sig = req.headers.get('stripe-signature');
    if (!sig || !webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature or webhook secret' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signature verification failed';
      return new Response(
        JSON.stringify({ error: `Webhook signature failed: ${msg}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const galleryId = session.metadata?.gallery_id;
      const selectedIdsRaw = session.metadata?.selected_photo_ids ?? '';

      if (!galleryId || !selectedIdsRaw) {
        return new Response(
          JSON.stringify({ error: 'Missing metadata in session' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const selectedIds = selectedIdsRaw.split(',').filter(Boolean);

      // 1. Mark selected photos
      const { error: photoErr } = await supabase
        .from('photos')
        .update({ is_selected: true })
        .in('id', selectedIds);
      if (photoErr) throw photoErr;

      // 2. Update gallery status
      const { error: galErr } = await supabase
        .from('galleries')
        .update({
          status: 'processing',
          selection_validated_at: new Date().toISOString(),
        })
        .eq('id', galleryId);
      if (galErr) throw galErr;

      // 3. Fetch gallery + selected photo filenames for photographer email
      const { data: gallery } = await supabase
        .from('galleries')
        .select('*')
        .eq('id', galleryId)
        .maybeSingle();

      const { data: selectedPhotos } = await supabase
        .from('photos')
        .select('filename')
        .in('id', selectedIds);

      // 4. Send photographer notification (best-effort)
      if (gallery) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-delivery-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'photographer_selection_notice',
              gallery_id: galleryId,
              client_name: gallery.client_name,
              client_email: gallery.client_email,
              selected_filenames: (selectedPhotos ?? []).map((p) => p.filename),
            }),
          });
        } catch {
          // best-effort
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
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
