import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import ListingCard from '@/components/features/ListingCard';
import { Button } from '@/components/ui/button';
import { fetchListings, fetchCategories } from '@/lib/api';
import type { Listing, Category } from '@/types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

export default function Marketplace() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState('newest');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  // Load categories from backend
  useEffect(() => {
    fetchCategories().then(cats => { if (cats.length > 0) setCategories(cats); }).catch(() => {});
  }, []);

  // Load listings from backend with debounce (wait for categories first)
  useEffect(() => {
    if (categories.length === 0) return; // Wait for categories to load first
    setListingsLoading(true);
    const timer = setTimeout(() => {
      let catIds: string[] | undefined;
      if (selectedCategory !== 'all') {
        const cat = categories.find(c => c.slug === selectedCategory);
        if (cat) {
          // Include the selected category and all its subcategories
          catIds = [
            cat.id,
            ...categories.filter(c => c.parentId === cat.id).map(c => c.id),
          ];
        }
      }
      fetchListings({
        categoryIds: catIds,
        search: searchQuery || undefined,
        minPrice: priceMin ? Number(priceMin) : undefined,
        maxPrice: priceMax ? Number(priceMax) : undefined,
        sort: sortBy,
      }).then(data => {
        setListings(data);
      }).catch(() => {
        setListings([]);
      }).finally(() => setListingsLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, sortBy, priceMin, priceMax, categories]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const listingsWithFav = listings.map(l => ({ ...l, isFavorited: favorites.includes(l.id) }));

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />

      {/* Sub-header */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <h1 className="font-heading text-xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>Marketplace</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {listingsLoading ? 'Loading…' : `${listingsWithFav.length} escrow-protected listings`}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Search listings..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }} />
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)' }}>
                {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Min Price ($)</label>
                <input type="number" placeholder="0" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Max Price ($)</label>
                <input type="number" placeholder="100000" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar Categories */}
          <aside className="hidden lg:block w-48 flex-shrink-0">
            <div className="sticky top-24 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <h3 className="font-heading font-semibold text-xs uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Categories</h3>
              <div className="space-y-0.5">
                <button onClick={() => setSelectedCategory('all')}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={selectedCategory === 'all'
                    ? { background: 'rgba(255,224,0,0.16)', color: '#FFE000', border: '1px solid rgba(255,224,0,0.28)' }
                    : { color: 'rgba(255,255,255,0.48)' }}>
                  All Categories
                </button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.slug)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between"
                    style={selectedCategory === cat.slug
                      ? { background: 'rgba(255,224,0,0.16)', color: '#FFE000', border: '1px solid rgba(255,224,0,0.28)' }
                      : { color: 'rgba(255,255,255,0.48)' }}>
                    <span>{cat.name}</span>
                    <span className="text-[10px]" style={{ color: selectedCategory === cat.slug ? 'rgba(255,224,0,0.65)' : 'rgba(255,255,255,0.28)' }}>{cat.listingCount}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Listings Grid */}
          <div className="flex-1 min-w-0">
            {listingsLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-[hsl(var(--brand-navy))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : listingsWithFav.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-heading font-semibold text-foreground mb-2">No listings found</h3>
                <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
                <Button variant="outline" className="mt-4" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setPriceMin(''); setPriceMax(''); }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {listingsWithFav.map(listing => (
                  <ListingCard key={listing.id} listing={listing} onFavorite={toggleFavorite} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
