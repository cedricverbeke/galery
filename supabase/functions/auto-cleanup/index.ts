import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Auto-cleanup: finds galleries where status = 'delivered' AND
 * deletion_scheduled_at < now(), purges their final-hd storage files,
 * and marks the gallery as 'expired'.
 *
 * Intended to be invoked by a Supabase Scheduled Function (cron) daily.
 * Can also be triggered manually via POST.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find expired delivered galleries
    const { data: galleries, error: galErr } = await supabase
      .from('galleries')
      .select('id, title, client_name')
      .eq('status', 'delivered')
      .lt('deletion_scheduled_at', new Date().toISOString());

    if (galErr) throw galErr;

    if (!galleries || galleries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No galleries to clean up', cleaned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let cleaned = 0;
    const errors: string[] = [];

    for (const g of galleries) {
      try {
        // 1. Get all final_hd photo paths for this gallery
        const { data: photos } = await supabase
          .from('photos')
          .select('file_path')
          .eq('gallery_id', g.id)
          .eq('type', 'final_hd');

        // 2. Remove from final-hd bucket
        if (photos && photos.length > 0) {
          const paths = photos.map((p) => p.file_path);
          const { error: rmErr } = await supabase.storage.from('final-hd').remove(paths);
          if (rmErr) {
            errors.push(`${g.id}: storage remove failed — ${rmErr.message}`);
          }
        }

        // 3. Delete final_hd photo records
        await supabase
          .from('photos')
          .delete()
          .eq('gallery_id', g.id)
          .eq('type', 'final_hd');

        // 4. Update gallery status to expired
        const { error: updErr } = await supabase
          .from('galleries')
          .update({ status: 'expired' })
          .eq('id', g.id);
        if (updErr) {
          errors.push(`${g.id}: status update failed — ${updErr.message}`);
        }

        cleaned++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${g.id}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({ cleaned, errors: errors.length > 0 ? errors : undefined }),
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
