import { type ReactNode } from 'react';
import { LayoutDashboard, Tag, Plus, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRoute, navigate, type Route } from '@/lib/router';
import { Logo } from '@/components/Logo';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  route: string;
  match: Route['name'][];
}

const NAV: NavItem[] = [
  { label: 'Tableau de bord', icon: LayoutDashboard, route: '/admin', match: ['admin'] },
  { label: 'Grilles tarifaires', icon: Tag, route: '/admin/pricing', match: ['admin-pricing'] },
  { label: 'Nouvelle galerie', icon: Plus, route: '/admin/new-gallery', match: ['admin-new-gallery', 'admin-gallery'] },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { lock } = useAuth();
  const route = useRoute();

  const activeName = route.name === 'admin-gallery' ? 'admin-new-gallery' : route.name;

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-700 bg-ink-900/50 backdrop-blur md:flex md:flex-col">
        <div className="flex h-20 items-center px-6">
          <Logo size="sm" onClick={() => navigate('/admin')} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-4">
          {NAV.map((item) => {
            const isActive = item.match.includes(activeName);
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sand-300/10 text-sand-300'
                    : 'text-muted hover:bg-ink-800 hover:text-cream'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-ink-700 p-4">
          <button
            onClick={() => {
              lock();
              navigate('/admin');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted transition-all hover:bg-ink-800 hover:text-cream"
          >
            <LogOut size={18} strokeWidth={1.5} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex h-16 items-center justify-between border-b border-ink-700 bg-ink-900/80 px-5 backdrop-blur md:hidden">
        <Logo size="sm" onClick={() => navigate('/admin')} />
        <div className="flex items-center gap-2">
          {NAV.map((item) => {
            const isActive = item.match.includes(activeName);
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isActive ? 'bg-sand-300/10 text-sand-300' : 'text-muted hover:bg-ink-800'
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
          <button
            onClick={() => {
              lock();
              navigate('/admin');
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink-800"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  );
}
