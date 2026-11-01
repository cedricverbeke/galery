import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useRoute } from '@/lib/router';
import { Landing } from '@/pages/Landing';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { PricingGridsPage } from '@/pages/admin/PricingGridsPage';
import { NewGalleryPage } from '@/pages/admin/NewGalleryPage';
import { AdminGalleryDetail } from '@/pages/admin/AdminGalleryDetail';
import { ClientAccess } from '@/pages/client/ClientAccess';
import { ClientGallery } from '@/pages/client/ClientGallery';
import { SuccessPage } from '@/pages/client/SuccessPage';
import { FullSpinner } from '@/components/Spinner';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed, loading } = useAuth();
  if (loading) return <FullSpinner label="Chargement…" />;
  if (!isAuthed) return <AdminLogin />;
  return <>{children}</>;
}

function Router() {
  const route = useRoute();

  switch (route.name) {
    case 'home':
      return <Landing />;
    case 'access':
      return <ClientAccess initialCode={route.code} />;
    case 'gallery':
      return <ClientGallery id={route.id} />;
    case 'success':
      return <SuccessPage sessionId={route.sessionId} />;
    case 'admin':
      return (
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      );
    case 'admin-pricing':
      return (
        <AdminRoute>
          <PricingGridsPage />
        </AdminRoute>
      );
    case 'admin-new-gallery':
      return (
        <AdminRoute>
          <NewGalleryPage />
        </AdminRoute>
      );
    case 'admin-gallery':
      return (
        <AdminRoute>
          <AdminGalleryDetail id={route.id} />
        </AdminRoute>
      );
    default:
      return <Landing />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
