import { useEffect, useState } from 'react';
import { Check, ArrowLeft, Mail, Camera } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { formatEuro } from '@/lib/format';
import { navigate } from '@/lib/router';

interface SessionDetails {
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  payment_status: string | null;
  metadata: {
    gallery_id?: string;
    client_name?: string;
  } | null;
}

export function SuccessPage({ sessionId }: { sessionId?: string }) {
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('Identifiant de session manquant.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-checkout-session?session_id=${encodeURIComponent(sessionId)}`,
          {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Erreur (${res.status})`);
        }
        const data = await res.json();
        setSession(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('La vérification du paiement prend trop de temps. Si vous avez reçu une confirmation par email, votre commande est validée.');
        } else {
          setError(err instanceof Error ? err.message : 'Impossible de vérifier le paiement.');
        }
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [sessionId]);

  const isPaid = session?.payment_status === 'paid';
  const galleryId = session?.metadata?.gallery_id;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 py-16">
      <Logo size="md" />

      <div className="mt-12 w-full max-w-md">
        {loading ? (
          <div className="flex flex-col items-center text-center">
            <Spinner size="lg" />
            <p className="mt-5 text-sm text-muted">Vérification de votre paiement…</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-700/40 bg-amber-900/20 text-amber-300">
              <Mail size={28} />
            </div>
            <h1 className="mt-6 font-display text-2xl font-medium text-cream">Paiement en cours de traitement</h1>
            <p className="mt-3 text-sm text-muted">{error}</p>
            <Button variant="ghost" onClick={() => navigate('/')} className="mt-8">
              <ArrowLeft size={16} /> Retour à l'accueil
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 animate-popIn items-center justify-center rounded-full border border-emerald-600/40 bg-emerald-900/20 text-emerald-300">
              <Check size={32} strokeWidth={2.5} />
            </div>

            <h1 className="mt-6 font-display text-3xl font-medium text-cream">Paiement confirmé</h1>
            <p className="mt-2 text-sm text-muted">
              Merci{session?.metadata?.client_name ? `, ${session.metadata.client_name}` : ''} ! Votre sélection a bien été enregistrée.
            </p>

            <div className="mt-8 space-y-3 rounded-2xl border border-ink-700 bg-ink-900/60 p-6 text-left">
              {session?.amount_total != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Montant payé</span>
                  <span className="font-medium text-cream">
                    {formatEuro(session.amount_total / 100)}
                  </span>
                </div>
              )}
              {session?.customer_email && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Email</span>
                  <span className="font-medium text-cream">{session.customer_email}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Statut</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isPaid ? 'Payé' : 'En cours'}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-blue-800/30 bg-blue-900/15 px-4 py-3 text-left text-xs text-blue-300">
              <div className="flex items-start gap-2">
                <Camera size={14} className="mt-0.5 shrink-0" />
                <p>
                  Vos photos retouchées sont en préparation. Vous recevrez un email à
                  {session?.customer_email ? ` ${session.customer_email}` : ' votre adresse'}
                  dès qu'elles seront disponibles.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => navigate(galleryId ? `/gallery/${galleryId}` : '/')}
              className="mt-8 w-full"
            >
              Retour à ma galerie
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
