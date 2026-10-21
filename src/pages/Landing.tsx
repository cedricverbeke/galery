import { Camera, Images, Heart, Shield, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { navigate } from '@/lib/router';

export function Landing() {
  return (
    <div className="min-h-screen bg-ink-950">
      {/* Navigation */}
      <nav className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/access')}>
              Accès client
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Espace studio
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-36 pb-16 text-center md:pt-44 md:pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900 via-ink-950 to-ink-950" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sand-300/5 blur-3xl" />

        <div className="relative z-10 max-w-3xl animate-slideUp">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sand-300/20 bg-sand-300/5 px-4 py-1.5 text-xs uppercase tracking-widest2 text-sand-300">
            <Sparkles size={13} /> Studio photo professionnel
          </div>
          <h1 className="font-display text-5xl font-medium leading-tight text-cream sm:text-6xl md:text-7xl">
            Sélectionnez <br />
            <span className="text-sand-300">en toute simplicité.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            Une galerie de tirage et de livraison haut de gamme. Vos clients sélectionnent leurs préférées,
            paient les suppléments, et reçoivent leurs photos retouchées en HD — le tout dans un flux élégant.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="outline" onClick={() => navigate('/access')}>
              <Camera size={17} /> Je suis client
            </Button>
          </div>
        </div>

        {/* Indicateur de défilement vers les Fonctionnalités */}
        <div className="relative z-10 mt-16 text-muted">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest2">Fonctionnalités</span>
            <div className="h-10 w-px bg-gradient-to-b from-sand-300/40 to-transparent" />
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="border-t border-ink-700 px-6 py-20 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-3">
            <Feature
              icon={Images}
              title="Aperçus filigranés"
              desc="Téléversez vos photos brutes et laissez vos clients parcourir des aperçus élégants et filigranés en plein écran."
            />
            <Feature
              icon={Heart}
              title="Sélection intelligente"
              desc="Vos clients choisissent leurs préférées avec un compteur en temps réel indiquant le quota inclus et le prix des suppléments."
            />
            <Feature
              icon={Shield}
              title="Livraison sécurisée"
              desc="Les photos HD retouchées sont livrées via des liens privés sécurisés, automatiquement supprimés après 30 jours."
            />
          </div>
        </div>
      </section>

      {/* Pied de page */}
      <footer className="border-t border-ink-700 px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-muted">© {new Date().getFullYear()} Déclic Studio. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Camera;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 transition-all duration-300 hover:border-sand-300/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sand-300/30 bg-sand-300/5 text-sand-300">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 font-display text-xl font-medium text-cream">{title}</h3>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );
}