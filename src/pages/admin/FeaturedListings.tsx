import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Loader2, RefreshCw, X, Star, Trash2,
  ChevronUp, ChevronDown, Image as ImageIcon, CheckCircle,
} from 'lucide-react';
import { admin, listings as listingsClient } from '@/lib/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FeaturedItem {
  featuredId: string;
  sortOrder: number;
  id: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  location: string;
  images: string[];
  categoryName: string;
  sellerName: string;
}

interface SearchResult {
  id: string;
  title: string;
  price: number;
  sellerName: string;
  categoryName: string;
  images: string[];
}

export default function AdminFeaturedListings() {
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const fetchFeatured = useCallback(async () => {
    try {
      const data = await admin.featuredListings.list();
      setFeatured(data || []);
    } catch {
      toast.error('Failed to load featured listings');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFeatured().finally(() => setLoading(false));
  }, [fetchFeatured]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeatured();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await listingsClient.list({ search: searchQuery.trim() });
      setSearchResults((data || []).map((l: any) => ({
        id: l.id, title: l.title, price: Number(l.price),
        sellerName: l.seller_username || 'Unknown',
        categoryName: l.category_name || 'Uncategorized',
        images: l.images || [],
      })));
    } catch {
      toast.error('Search failed');
    }
    setSearching(false);
  };

  const handleAddFeatured = async (listingId: string) => {
    setAdding(true);
    try {
      await admin.featuredListings.add(listingId);
      toast.success('Added to featured');
      await fetchFeatured();
      setSearchResults(prev => prev.filter(r => r.id !== listingId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to add');
    }
    setAdding(false);
  };

  const handleRemove = async (featuredId: string) => {
    try {
      await admin.featuredListings.remove(featuredId);
      toast.success('Removed from featured');
      await fetchFeatured();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = featured.map(f => f.featuredId);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    try {
      await admin.featuredListings.reorder(ids);
      await fetchFeatured();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === featured.length - 1) return;
    const ids = featured.map(f => f.featuredId);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try {
      await admin.featuredListings.reorder(ids);
      await fetchFeatured();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder');
    }
  };

  const handleSync = async () => {
    toast.success('Featured listings are synced live — changes are immediately visible on the homepage');
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#C68000' }} />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>Featured Listings</h1>
          <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>
            {featured.length} featured listing{featured.length !== 1 ? 's' : ''} · Changes apply immediately to the homepage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg transition-colors"
            style={{ border: '1px solid rgba(200,160,60,0.15)', color: '#9A7C40' }}>
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setShowSearchPanel(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.28)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.18)'}>
            <Plus className="w-4 h-4" /> Add Listing
          </button>
          <button onClick={handleSync}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.30)', color: 'rgba(52,211,153,0.90)' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(52,211,153,0.15)'}>
            <CheckCircle className="w-4 h-4" /> Sync
          </button>
        </div>
      </div>

      {/* Search Panel */}
      {showSearchPanel && (
        <div className="mb-6 rounded-xl overflow-hidden" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.16)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(200,160,60,0.10)', borderBottom: '1px solid rgba(200,160,60,0.12)' }}>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: '#C68000' }} />
              <span className="text-sm font-semibold" style={{ color: '#2A1A00' }}>Search Listings to Feature</span>
            </div>
            <button onClick={() => { setShowSearchPanel(false); setSearchResults([]); setSearchQuery(''); }}
              className="p-1 rounded-lg transition-colors" style={{ color: '#9A7C40' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B8A070' }} />
                <input type="text" placeholder="Search by title..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 transition-all"
                  style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }} />
              </div>
              <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
            {searchResults.length === 0 && !searching && searchQuery && (
              <p className="text-sm" style={{ color: '#9A7C40' }}>No listings found. Try a different search.</p>
            )}
            {searching && (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#C68000' }} />
                <span className="text-sm" style={{ color: '#9A7C40' }}>Searching...</span>
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {searchResults.map(listing => {
                  const alreadyFeatured = featured.some(f => f.id === listing.id);
                  return (
                    <div key={listing.id} className="flex items-center justify-between p-3 rounded-xl transition-colors"
                      style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(200,160,60,0.10)' }}>
                          {listing.images?.[0] ? (
                            <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4" style={{ color: '#B8A070' }} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: '#2A1A00' }}>{listing.title}</p>
                          <p className="text-xs" style={{ color: '#9A7C40' }}>
                            ${Number(listing.price).toLocaleString()} · {listing.categoryName}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleAddFeatured(listing.id)} disabled={adding || alreadyFeatured}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ml-2"
                        style={alreadyFeatured
                          ? { background: 'rgba(52,211,153,0.12)', color: 'rgba(52,211,153,0.70)', cursor: 'default' }
                          : { background: 'rgba(200,160,60,0.14)', border: '1px solid rgba(200,160,60,0.30)', color: '#C68000' }}>
                        {alreadyFeatured ? 'Already Featured' : 'Feature'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Featured Listings Grid */}
      {featured.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
          <Star className="w-10 h-10 mb-3 opacity-20" style={{ color: '#9A7C40' }} />
          <p className="text-sm" style={{ color: '#9A7C40' }}>No featured listings yet</p>
          <p className="text-xs mt-1" style={{ color: '#C8B090' }}>Click "Add Listing" to feature listings on the homepage</p>
          <button onClick={() => setShowSearchPanel(true)}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}>
            <Plus className="w-4 h-4" /> Add First Featured Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {featured.map((item, index) => (
            <div key={item.featuredId} className="rounded-xl overflow-hidden transition-all"
              style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.14)' }}>
              {/* Image */}
              <div className="relative h-36 overflow-hidden" style={{ background: 'rgba(200,160,60,0.08)' }}>
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8" style={{ color: '#C8B090' }} />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(240,184,0,0.25)', border: '1px solid rgba(240,184,0,0.50)', color: '#C68000' }}>
                    #{index + 1}
                  </span>
                </div>
                <button onClick={() => handleRemove(item.featuredId)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg transition-all opacity-0 hover:opacity-100"
                  style={{ background: 'rgba(239,68,68,0.20)', color: 'rgba(252,165,165,0.90)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Info */}
              <div className="p-3.5">
                <p className="text-sm font-semibold truncate" style={{ color: '#2A1A00' }}>{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold" style={{ color: '#C68000' }}>${Number(item.price).toLocaleString()}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(200,160,60,0.10)', color: '#9A7C40' }}>{item.categoryName}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3"
                  style={{ borderTop: '1px solid rgba(200,160,60,0.10)' }}>
                  <div className="flex gap-1">
                    <button onClick={() => handleMoveUp(index)} disabled={index === 0}
                      className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                      style={{ color: '#B8A070' }}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleMoveDown(index)} disabled={index === featured.length - 1}
                      className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                      style={{ color: '#B8A070' }}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px]" style={{ color: '#C8B090' }}>{item.sellerName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {featured.length > 0 && (
        <div className="mt-6 flex items-center gap-4 px-4 py-3 rounded-xl text-xs" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
          <span style={{ color: '#9A7C40' }}>
            <strong style={{ color: '#4A3010' }}>{featured.length}</strong> featured listing{featured.length !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#C8B090' }}>·</span>
          <span style={{ color: '#9A7C40' }}>
            <strong style={{ color: '#4A3010' }}>${featured.reduce((s, f) => s + Number(f.price), 0).toLocaleString()}</strong> total value
          </span>
          <span style={{ color: '#C8B090' }}>·</span>
          <span style={{ color: '#9A7C40' }}>Changes sync instantly — no deploy needed</span>
        </div>
      )}
    </div>
  );
}