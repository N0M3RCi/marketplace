import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen" style={{ background: '#FFFDF5' }}>
      <AdminSidebar />
      {/* pt-14 on mobile to clear the hamburger button */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
