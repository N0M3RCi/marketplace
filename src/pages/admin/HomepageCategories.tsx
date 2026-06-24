import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  LayoutGrid, Eye, EyeOff, CheckCircle2, RotateCcw, Home,
  ArrowUpDown, ChevronRight, Loader2, AlertCircle
} from 'lucide-react';
import { admin } from '@/lib/client';
import type { Category } from '@/types';
import { useNavigate } from 'react-router-dom';

export default function HomepageCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const data = await admin.categories.list();
      setCategories(data || []);
    } catch (err: any) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFeatured(cat: Category) {
    const newVal = !cat.homepageFeatured;
    setToggling(cat.id);
    // Optimistic update
    setCategories(prev => prev.map(c =>
      c.id === cat.id ? { ...c, homepageFeatured: newVal } : c
    ));
    try {
      await fetch(`/api/admin/categories/${cat.id}/homepage-featured`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ featured: newVal }),
      });
      toast.success(newVal ? `"${cat.name}" is now on the homepage` : `"${cat.name}" removed from homepage`);
    } catch (err: any) {
      // Revert on error
      setCategories(prev => prev.map(c =>
        c.id === cat.id ? { ...c, homepageFeatured: !newVal } : c
      ));
      toast.error('Failed to update');
    } finally {
      setToggling(null);
    }
  }

  const featuredCount = categories.filter(c => c.homepageFeatured).length;
  const totalCount = categories.length;

  // Split: top-level categories first, then subcategories
  const topLevelCategories = categories.filter(c => !c.parentId);
  const subCategories = categories.filter(c => c.parentId);

  function renderCategoryCard(cat: Category) {
    const isFeatured = cat.homepageFeatured;
    const isToggling = toggling === cat.id;
    const iconMap: Record<string, string> = {
      Laptop: '💻', Watch: '⌚', Car: '🚗', Gem: '💎', Palette: '🎨',
      Trophy: '🏆', Music: '🎵', Building2: '🏢', Tag: '🏷️', Shirt: '👕',
      Shoe: '👟', Book: '📚', BookOpen: '📖', Phone: '📱', Camera: '📷',
      Headphones: '🎧', Gamepad: '🎮', Sparkles: '✨', Heart: '❤️',
      Star: '⭐', Zap: '⚡', Sun: '☀️', Moon: '🌙', Globe: '🌍',
      Home: '🏠', Wrench: '🔧'
    };
    const emoji = iconMap[cat.icon] || '🏷️';

    return (
      <div
        key={cat.id}
        className="group rounded-2xl transition-all duration-300"
        style={{
          background: isFeatured
            ? 'linear-gradient(135deg, rgba(240,184,0,0.08) 0%, rgba(255,215,0,0.05) 100%)'
            : 'rgba(255,255,255,0.75)',
          border: isFeatured
            ? '1.5px solid rgba(240,184,0,0.40)'
            : '1px solid rgba(200,180,140,0.20)',
          boxShadow: isFeatured
            ? '0 2px 16px rgba(240,184,0,0.10)'
            : '0 1px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div className="p-4 flex items-center gap-4">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{
              background: isFeatured
                ? 'rgba(240,184,0,0.15)'
                : 'rgba(200,180,140,0.12)',
              border: isFeatured
                ? '1px solid rgba(240,184,0,0.35)'
                : '1px solid rgba(200,180,140,0.20)',
            }}
          >
            {emoji}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold truncate" style={{ color: '#1A1000' }}>
                {cat.name}
              </p>
              {cat.parentId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{
                  background: 'rgba(200,180,140,0.15)',
                  color: '#9A7C40',
                  border: '1px solid rgba(200,180,140,0.25)',
                }}>
                  Sub
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: '#9A7C40' }}>
              {cat.listingCount} listing{cat.listingCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Listing count badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg" style={{
            background: cat.listingCount > 0 ? 'rgba(22,163,74,0.10)' : 'rgba(200,180,140,0.10)',
            color: cat.listingCount > 0 ? '#166534' : '#9A7C40',
            border: `1px solid ${cat.listingCount > 0 ? 'rgba(22,163,74,0.25)' : 'rgba(200,180,140,0.20)'}`,
          }}>
            {cat.listingCount}
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => toggleFeatured(cat)}
            disabled={isToggling}
            className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0"
            style={{
              background: isFeatured
                ? 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)'
                : 'rgba(200,180,140,0.25)',
              boxShadow: isFeatured
                ? '0 2px 8px rgba(240,184,0,0.30)'
                : 'inset 0 1px 3px rgba(0,0,0,0.08)',
              cursor: isToggling ? 'wait' : 'pointer',
            }}
            title={isFeatured ? 'Remove from homepage' : 'Show on homepage'}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 flex items-center justify-center"
              style={{
                left: isFeatured ? '24px' : '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            >
              {isToggling ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: '#C68000' }} />
              ) : isFeatured ? (
                <CheckCircle2 className="w-2.5 h-2.5" style={{ color: '#B87000' }} />
              ) : null}
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto" style={{ background: '#FFFDF5', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg" style={{
            background: 'rgba(240,184,0,0.14)',
            border: '1px solid rgba(240,184,0,0.28)',
            color: '#8B6000',
          }}>
            <LayoutGrid className="w-3 h-3" />
            Homepage Curation
          </div>
        </div>
        <h1 className="font-heading text-2xl font-bold mb-1" style={{ color: '#1A1000' }}>
          Homepage Categories
        </h1>
        <p className="text-sm" style={{ color: '#9A7C40' }}>
          Toggle which categories appear in the "Browse by Category" section on your front page
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(240,184,0,0.18)' }}>
          <p className="text-2xl font-bold font-heading" style={{ color: '#C68000' }}>{featuredCount}</p>
          <p className="text-xs" style={{ color: '#9A7C40' }}>Featured on homepage</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(240,184,0,0.18)' }}>
          <p className="text-2xl font-bold font-heading" style={{ color: '#1A1000' }}>{totalCount}</p>
          <p className="text-xs" style={{ color: '#9A7C40' }}>Total categories</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(240,184,0,0.18)' }}>
          <p className="text-2xl font-bold font-heading" style={{ color: featuredCount > 0 ? '#16a34a' : '#9A7C40' }}>
            {featuredCount > 0 ? Math.round((featuredCount / totalCount) * 100) : 0}%
          </p>
          <p className="text-xs" style={{ color: '#9A7C40' }}>Coverage</p>
        </div>
        <button
          onClick={() => navigate('/admin/categories')}
          className="rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: 'rgba(240,184,0,0.08)', border: '1px solid rgba(240,184,0,0.25)' }}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#B87000' }}>
            <LayoutGrid className="w-4 h-4" />
            Manage All
          </div>
          <p className="text-xs mt-1" style={{ color: '#9A7C40' }}>Categories</p>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#C68000' }} />
        </div>
      ) : totalCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {/* Top-Level Categories */}
          {topLevelCategories.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{
                  background: 'rgba(240,184,0,0.14)',
                  border: '1px solid rgba(240,184,0,0.28)',
                }}>
                  <Home className="w-3 h-3" style={{ color: '#B87000' }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: '#1A1000' }}>
                  Main Categories
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                  background: 'rgba(200,180,140,0.12)',
                  color: '#9A7C40',
                  border: '1px solid rgba(200,180,140,0.20)',
                }}>
                  {topLevelCategories.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topLevelCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}

          {/* Subcategories */}
          {subCategories.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{
                  background: 'rgba(200,180,140,0.12)',
                  border: '1px solid rgba(200,180,140,0.22)',
                }}>
                  <ArrowUpDown className="w-3 h-3" style={{ color: '#9A7C40' }} />
                </div>
                <h2 className="text-sm font-semibold" style={{ color: '#1A1000' }}>
                  Subcategories
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                  background: 'rgba(200,180,140,0.12)',
                  color: '#9A7C40',
                  border: '1px solid rgba(200,180,140,0.20)',
                }}>
                  {subCategories.length}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}

          {/* Preview note */}
          <div className="rounded-2xl p-4 flex items-start gap-3 mt-4" style={{
            background: 'rgba(240,184,0,0.06)',
            border: '1px solid rgba(240,184,0,0.18)',
          }}>
            <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#B87000' }} />
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: '#1A1000' }}>Live Preview</p>
              <p className="text-xs" style={{ color: '#9A7C40' }}>
                Changes take effect immediately. The top 4 featured categories (with active listings) will appear on
                the homepage in the "Browse by Category" section. Categories without active listings won't display
                until they have at least one active listing.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{
        background: 'rgba(240,184,0,0.10)',
        border: '1px solid rgba(240,184,0,0.25)',
      }}>
        <AlertCircle className="w-7 h-7" style={{ color: '#C68000' }} />
      </div>
      <h3 className="font-heading text-lg font-bold mb-1" style={{ color: '#1A1000' }}>No Categories Found</h3>
      <p className="text-sm mb-6" style={{ color: '#9A7C40' }}>
        Create categories first so you can choose which ones appear on the homepage.
      </p>
      <a
        href="/admin/categories"
        className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
        style={{
          background: 'linear-gradient(135deg, #E8A800 0%, #F0B800 100%)',
          color: '#FFFFFF',
          boxShadow: '0 4px 16px rgba(180,130,0,0.35)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(180,130,0,0.45)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(180,130,0,0.35)';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        Go to Categories <ChevronRight className="w-4 h-4" />
      </a>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 text-xs mt-4 px-3 py-1.5 rounded-lg transition-all"
        style={{ color: '#9A7C40' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#B87000'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A7C40'; }}
      >
        <RotateCcw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}