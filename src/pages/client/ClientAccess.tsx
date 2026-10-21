import { useState, type FormEvent } from 'react';
import { Lock, ArrowRight, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { navigate } from '@/lib/router';

interface ClientAccessData {
  gallery: {
    id: string;
    title: string;
    client_name: string;
    status: string;
  };
  pricing_grid: unknown;
  preview_photos: unknown[];
}

export function ClientAccess({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foundGallery, setFoundGallery] = useState<ClientAccessData | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.rpc('get_client_gallery', {
      p_access_code: code.trim(),
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.error === 'not_found') {
      setError('Aucune galerie trouvée avec ce code. Veuillez vérifier et réessayer.');
      return;
    }

    setFoundGallery(data as ClientAccessData);
  };

  if (foundGallery) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm animate-slideUp text-center">
          <Logo size="lg" />
          <div className="mt-10 rounded-2xl border border-ink-600 bg-ink-900/60 p-8">
            <h1 className="font-display text-2xl font-medium text-cream">{foundGallery.gallery.title}</h1>
            <p className="mt-2 text-sm text-muted">Pour {foundGallery.gallery.client_name}</p>
            <Button
              onClick={() => navigate(`/gallery/${foundGallery.gallery.id}`)}
              size="lg"
              className="mt-6 w-full"
            >
              Entrer dans la galerie <ArrowRight size={16} />
            </Button>
          </div>
          <button
            onClick={() => setFoundGallery(null)}
            className="mt-6 text-xs text-muted hover:text-sand-300"
          >
            Utiliser un autre code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slideUp">
        <div className="mb-10 flex flex-col items-center">
          <Logo size="lg" />
          <p className="mt-4 text-sm text-muted">Saisissez votre code d'accès pour voir vos photos.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-ink-600 bg-ink-900/60 p-8 backdrop-blur">
          <Input
            label="Code d'accès"
            required
            placeholder="ex. AB12CD"
            icon={<KeyRound size={16} />}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            className="text-center text-lg tracking-widest"
          />

          {error && (
            <p className="mt-4 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="mt-6 w-full">
            <Lock size={15} /> Déverrouiller la galerie
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-muted transition-colors hover:text-sand-300"
          >
            ← Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
}
