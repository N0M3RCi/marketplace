import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000000' }}>
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-16 h-16 rounded-2xl navy-gradient flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-heading text-6xl font-bold mb-3" style={{ color: '#FFE000' }}>404</h1>
        <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.88)' }}>Page Not Found</h2>
        <p className="mb-8" style={{ color: 'rgba(255,255,255,0.42)' }}>The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 navy-gradient text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to SafeEscrow
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
