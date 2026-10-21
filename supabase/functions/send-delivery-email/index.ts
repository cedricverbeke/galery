import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailBody {
  type?: 'photographer_selection_notice' | undefined;
  gallery_id?: string;
  client_name?: string;
  client_email?: string;
  selected_filenames?: string[];
  download_urls?: { filename: string; url: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EmailBody = await req.json();

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'no-reply@declic.studio';
    const photographerEmail = Deno.env.get('PHOTOGRAPHER_EMAIL');

    if (!resendKey) {
      // No email provider configured — log and return success (best-effort)
      console.log('[send-delivery-email] No RESEND_API_KEY configured. Email not sent.', body);
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no_email_provider' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isPhotographerNotice = body.type === 'photographer_selection_notice';

    if (isPhotographerNotice) {
      // Email the photographer about client's selection
      const to = photographerEmail;
      if (!to) {
        console.log('[send-delivery-email] No PHOTOGRAPHER_EMAIL configured.');
        return new Response(
          JSON.stringify({ status: 'skipped', reason: 'no_photographer_email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const fileList = (body.selected_filenames ?? []).join('  ');

      const html = `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #161616; color: #F5F5F5; padding: 40px;">
          <h1 style="font-family: 'Cormorant Garamond', serif; color: #D4B996; font-size: 28px;">Nouvelle sélection validée</h1>
          <p style="color: #A3A3A3;">Votre client <strong style="color: #F5F5F5;">${body.client_name}</strong> vient de valider sa sélection de photos.</p>
          <div style="background: #0D0D0D; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="color: #D4B996; margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Photos à retoucher</p>
            <p style="color: #F5F5F5; font-size: 14px; margin: 0; line-height: 1.8; word-break: break-all;">${fileList || 'Aucune photo listée.'}</p>
          </div>
          <p style="color: #A3A3A3;">Connectez-vous à votre espace studio pour téléverser les versions HD retouchées et les livrer à votre client.</p>
        </div>
      `;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Déclic Studio <${fromEmail}>`,
          to,
          subject: `Nouvelle sélection de ${body.client_name}`,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[send-delivery-email] Resend error:', errText);
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ status: 'sent', to }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Client delivery email
    if (!body.client_email) {
      return new Response(
        JSON.stringify({ error: 'Missing client_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const linkList = (body.download_urls ?? [])
      .map((d) => `<li style="margin: 8px 0;"><a href="${d.url}" style="color: #D4B996; text-decoration: none;">${d.filename}</a></li>`)
      .join('');

    const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background: #161616; color: #F5F5F5; padding: 40px;">
        <h1 style="font-family: 'Cormorant Garamond', serif; color: #D4B996; font-size: 32px;">Vos photos sont prêtes</h1>
        <p style="color: #A3A3A3; font-size: 16px;">Bonjour ${body.client_name},</p>
        <p style="color: #A3A3A3; font-size: 16px;">Vos photos retouchées en HD sont désormais disponibles au téléchargement. Vous avez <strong style="color: #D4B996;">exactement 30 jours</strong> pour les récupérer avant leur suppression automatique.</p>
        <div style="background: #0D0D0D; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <p style="color: #D4B996; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Liens de téléchargement</p>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 15px;">${linkList}</ul>
        </div>
        <p style="color: #A3A3A3; font-size: 13px;">Veuillez télécharger toutes vos photos avant l'échéance. Après 30 jours, les fichiers seront définitivement supprimés.</p>
        <hr style="border: none; border-top: 1px solid #2E2E2E; margin: 32px 0;" />
        <p style="color: #5F4B34; font-size: 12px;">Déclic Studio</p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Déclic Studio <${fromEmail}>`,
        to: body.client_email,
        subject: 'Vos photos retouchées sont prêtes — Déclic Studio',
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[send-delivery-email] Resend error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ status: 'sent', to: body.client_email }),
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
