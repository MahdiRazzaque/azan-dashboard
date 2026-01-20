import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * A wrapper component that restricts access to its children based on the user's
 * authentication status. Redirects unauthenticated users to the login page.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The components to render if authenticated.
 * @returns {JSX.Element} The rendered children or a navigation redirect.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-app-bg text-emerald-500">
            <Loader2 className="w-8 h-8 animate-spin" />
        </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
