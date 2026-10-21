import { useState, type FormEvent } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Logo } from '@/components/Logo';
import { navigate } from '@/lib/router';

export function AdminLogin() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (unlock(password)) {
      navigate('/admin');
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-slideUp">
        <div className="mb-10 flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="rounded-2xl border border-ink-600 bg-ink-900/60 p-8 backdrop-blur">
          <h1 className="font-display text-2xl font-medium text-cream">Espace Studio</h1>
          <p className="mt-1.5 text-sm text-muted">Entrez votre mot de passe pour accéder au tableau de bord.</p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
            <Input
              label="Mot de passe"
              type="password"
              required
              autoFocus
              placeholder="••••••••"
              icon={<Lock size={16} />}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
            />

            {error && (
              <p className="rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                Mot de passe incorrect.
              </p>
            )}

            <Button type="submit" className="mt-2 w-full" size="lg">
              Se connecter <ArrowRight size={16} />
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/access')}
            className="text-xs text-muted transition-colors hover:text-sand-300"
          >
            Vous êtes client ? Accédez à votre galerie →
          </button>
        </div>
      </div>
    </div>
  );
}
