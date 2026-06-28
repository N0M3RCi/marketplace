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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
