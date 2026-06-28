import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, Plus, Tag, DollarSign, MapPin, FileText, CheckCircle,
  Loader2, ChevronLeft, AlertTriangle, Trash2, ShieldCheck
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { fetchCategories, createListing } from '@/lib/api';
import { admin, storage as storageClient } from '@/lib/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const CONDITIONS = [
  { value: 'new', label: 'Brand New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Well Used' },
] as const;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];

const MAX_SLOTS = 10;
const DEFAULT_SLOTS = 5;

interface ListingSlot {
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  location: string;
  price: string;
  currency: string;
  images: File[];
  imageUrls: string[];
}

function emptySlot(): ListingSlot {
  return {
    title: '',
    description: '',
    categoryId: '',
    condition: 'good',
    location: '',
    price: '',
    currency: 'USD',
    images: [],
    imageUrls: [],
  };
}

interface SlotResult {
  index: number;
  success: boolean;
  title: string;
  error?: string;
}

export default function BulkUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [slots, setSlots] = useState<ListingSlot[]>(() =>
    Array.from({ length: DEFAULT_SLOTS }, () => emptySlot())
  );
  const [submitting, setSubmitting] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number>(-1);
  const [results, setResults] = useState<SlotResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; username: string; email: string }[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  // Load sellers for admin assignment
  useEffect(() => {
    if (user?.role === 'admin') {
      admin.users.list().then((data: any[]) => {
        const list = data.map((u: any) => ({ id: u.id, username: u.username || u.email?.split('@')[0] || 'Unknown', email: u.email }));
        setSellers(list);
      }).catch(() => {});
    }
  }, [user]);

  const updateSlot = (idx: number, field: keyof ListingSlot, value: any) => {
    setSlots(prev => prev.map((slot, i) => i === idx ? { ...slot, [field]: value } : slot));
  };

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    setSlots(prev => [...prev, emptySlot()]);
  };

  const removeSlot = (idx: number) => {
    if (slots.length <= 1) return;
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFilePick = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) toast.warning('Some files exceeded 10 MB and were skipped');
    const previews = valid.map(f => URL.createObjectURL(f));
    const slot = slots[idx];
    updateSlot(idx, 'images', [...slot.images, ...valid].slice(0, 8));
    updateSlot(idx, 'imageUrls', [...slot.imageUrls, ...previews].slice(0, 8));
    if (e.target) e.target.value = '';
  };

  const removeImage = (slotIdx: number, imgIdx: number) => {
    const slot = slots[slotIdx];
    const removed = slot.imageUrls[imgIdx];
    if (removed) URL.revokeObjectURL(removed);
    updateSlot(slotIdx, 'images', slot.images.filter((_, i) => i !== imgIdx));
    updateSlot(slotIdx, 'imageUrls', slot.imageUrls.filter((_, i) => i !== imgIdx));
  };

  const uploadImagesForSlot = async (slot: ListingSlot): Promise<string[]> => {
    const uploaded: string[] = [];
    for (const file of slot.images) {
      try {
        const result = await storageClient.upload(file);
        uploaded.push(result.url);
      } catch (err) {
        console.error('Image upload error:', err);
      }
    }
    return uploaded;
  };

  const isSlotValid = (slot: ListingSlot): string | null => {
    if (!slot.title.trim() || slot.title.trim().length < 5) return 'Title must be at least 5 characters';
    if (!slot.description.trim() || slot.description.trim().length < 20) return 'Description must be at least 20 characters';
    if (!slot.categoryId) return 'Category is required';
    if (!slot.location.trim()) return 'Location is required';
    if (!slot.price || Number(slot.price) <= 0) return 'Price must be greater than 0';
    if (slot.images.length === 0) return 'At least 1 photo is required';
    return null;
  };

  const handleSubmitAll = async () => {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    setResults([]);
    setShowResults(false);

    const slotResults: SlotResult[] = [];

    for (let i = 0; i < slots.length; i++) {
      setProcessingIndex(i);
      const slot = slots[i];
      const validationError = isSlotValid(slot);

      if (validationError) {
        slotResults.push({ index: i + 1, success: false, title: slot.title || '(empty)', error: validationError });
        continue;
      }

      try {
        const imageUrls = await uploadImagesForSlot(slot);
        await createListing({
          title: slot.title.trim(),
          description: slot.description.trim(),
          categoryId: slot.categoryId,
          condition: slot.condition as any,
          location: slot.location.trim(),
          price: Number(slot.price),
          currency: slot.currency,
          images: imageUrls,
          sellerId: selectedSellerId || user.id,
        });
        slotResults.push({ index: i + 1, success: true, title: slot.title.trim() });
      } catch (err: any) {
        slotResults.push({ index: i + 1, success: false, title: slot.title.trim(), error: err?.message || 'Failed to create listing' });
      }
    }

    setProcessingIndex(-1);
    setResults(slotResults);
    setShowResults(true);
    setSubmitting(false);

    const successes = slotResults.filter(r => r.success).length;
    const failures = slotResults.filter(r => !r.success).length;

    if (failures === 0) {
      toast.success(`All ${successes} listings created successfully!`);
    } else {
      toast.error(`${successes} created, ${failures} failed — review results below`);
    }
  };

  const resetAll = () => {
    setSlots(Array.from({ length: DEFAULT_SLOTS }, () => emptySlot()));
    setResults([]);
    setShowResults(false);
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen" style={{ background: '#000000' }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(255,224,0,0.10)', border: '1px solid rgba(255,224,0,0.22)' }}>
            <ShieldCheck className="w-8 h-8" style={{ color: 'rgba(255,224,0,0.75)' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-3" style={{ color: 'rgba(255,255,255,0.90)' }}>Admin Only</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Bulk listing upload is available to administrators only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>Bulk Upload Listings</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Create {slots.length} listing{slots.length !== 1 ? 's' : ''} at once — all fields match the single listing form
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/sell')}
              size="sm"
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', background: 'transparent' }}
            >
              Single Listing
            </Button>
            {slots.length < MAX_SLOTS && (
              <Button onClick={addSlot} size="sm" className="navy-gradient text-white border-0 hover:opacity-90">
                <Plus className="w-4 h-4 mr-1.5" /> Add Slot
              </Button>
            )}
          </div>
        </div>

        {/* Results Summary */}
        {showResults && results.length > 0 && (
          <div className="mb-6 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.88)' }}>Results</h2>
            </div>
            <div className="divide-y divide-border/50">
              {results.map((r) => (
                <div key={r.index} className="px-5 py-3 flex items-center gap-3">
                  {r.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.40)' }}>#{r.index}</span>
                  <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{r.title || '(untitled)'}</span>
                  {r.success ? (
                    <span className="text-xs text-emerald-500 font-medium">Created</span>
                  ) : (
                    <span className="text-xs text-red-400 font-medium">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 flex justify-between items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.50)' }}>
                {results.filter(r => r.success).length} / {results.length} created
              </span>
              <Button onClick={resetAll} size="sm" variant="outline" className="text-xs"
                style={{ borderColor: 'rgba(255,224,0,0.30)', color: '#FFE000', background: 'transparent' }}>
                Start Fresh
              </Button>
            </div>
          </div>
        )}

        {/* Assign Seller (admin) */}
        <div className="mb-6 rounded-xl p-4" style={{ background: 'rgba(255,215,60,0.06)', border: '1px solid rgba(255,215,60,0.20)' }}>
          <label className="block text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,235,100,0.85)' }}>
            Assign All Listings To
          </label>
          <select
            value={selectedSellerId}
            onChange={e => setSelectedSellerId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
          >
            <option value="">Myself (admin)</option>
            {sellers.filter(s => s.id !== user.id).map(s => (
              <option key={s.id} value={s.id}>{s.username} ({s.email})</option>
            ))}
          </select>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Applies to all slots below
          </p>
        </div>

        {/* Listing Slots */}
        <div className="space-y-4 mb-6">
          {slots.map((slot, idx) => (
            <div key={idx} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,60,0.12)' }}>
              {/* Slot Header */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'rgba(255,215,60,0.70)' }}>#{idx + 1}</span>
                  {slot.title.trim() && (
                    <span className="text-xs truncate max-w-[200px]" style={{ color: 'rgba(255,255,255,0.50)' }}>{slot.title.trim()}</span>
                  )}
                  {submitting && processingIndex === idx && (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'rgba(255,215,60,0.60)' }} />
                  )}
                </div>
                {slots.length > 1 && !submitting && (
                  <button onClick={() => removeSlot(idx)} className="p-1 rounded transition-colors" style={{ color: 'rgba(239,68,68,0.5)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.9)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.5)'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Slot Body — compact grid layout */}
              <div className="p-5 space-y-4">
                {/* Row 1: Title + Location */}
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Title <span className="text-red-400">*</span></label>
                    <input type="text" value={slot.title} onChange={e => updateSlot(idx, 'title', e.target.value)}
                      placeholder="e.g. Apple MacBook Pro 16"
                      maxLength={120}
                      className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <MapPin className="inline w-3 h-3 mr-0.5" /> Location <span className="text-red-400">*</span>
                    </label>
                    <input type="text" value={slot.location} onChange={e => updateSlot(idx, 'location', e.target.value)}
                      placeholder="e.g. New York, NY"
                      className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }} />
                  </div>
                </div>

                {/* Row 2: Category + Condition + Price */}
                <div className="grid sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Category <span className="text-red-400">*</span></label>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.slice(0, 6).map(cat => (
                        <button key={cat.id} type="button" onClick={() => updateSlot(idx, 'categoryId', cat.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                          style={slot.categoryId === cat.id
                            ? { background: 'rgba(255,215,60,0.15)', border: '1px solid rgba(255,215,60,0.35)', color: 'rgba(255,235,100,0.90)' }
                            : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
                        >{cat.name}</button>
                      ))}
                      {categories.length > 6 && (
                        <select value={slot.categoryId} onChange={e => updateSlot(idx, 'categoryId', e.target.value)}
                          className="px-2 py-1 rounded-lg text-[11px]"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
                          <option value="">More...</option>
                          {categories.slice(6).map(cat => (
                            <option key={cat.id} value={cat.id} style={{ background: '#111', color: '#eee' }}>{cat.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Condition <span className="text-red-400">*</span></label>
                    <select value={slot.condition} onChange={e => updateSlot(idx, 'condition', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
                      {CONDITIONS.map(c => <option key={c.value} value={c.value} style={{ background: '#111', color: '#eee' }}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      <DollarSign className="inline w-3 h-3" /> Price <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-1">
                      <select value={slot.currency} onChange={e => updateSlot(idx, 'currency', e.target.value)}
                        className="w-16 px-1 py-2 text-xs rounded-xl focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)' }}>
                        {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#111', color: '#eee' }}>{c}</option>)}
                      </select>
                      <input type="number" value={slot.price} onChange={e => updateSlot(idx, 'price', e.target.value)}
                        placeholder="0.00" min="1" step="0.01"
                        className="flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Description */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Description <span className="text-red-400">*</span></label>
                  <textarea value={slot.description} onChange={e => updateSlot(idx, 'description', e.target.value)}
                    placeholder="Describe the item in detail..."
                    rows={2} maxLength={2000}
                    className="w-full px-3 py-2 text-sm rounded-xl focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }} />
                </div>

                {/* Row 4: Images */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Photos <span className="text-red-400">*</span>
                    <span className="font-normal ml-1" style={{ color: 'rgba(255,255,255,0.30)' }}>({slot.images.length}/8)</span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {slot.imageUrls.map((url, imgIdx) => (
                      <div key={imgIdx} className="relative w-14 h-14 rounded-lg overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {imgIdx === 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-[hsl(var(--brand-navy))]/80 text-white text-[8px] text-center leading-tight px-1">Main</div>
                        )}
                        <button onClick={() => removeImage(idx, imgIdx)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        ><X className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                    {slot.images.length < 8 && (
                      <label className="w-14 h-14 rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center cursor-pointer hover:border-[hsl(var(--brand-navy))]/50 transition-colors">
                        <Plus className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.30)' }} />
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                          onChange={e => handleFilePick(idx, e)} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {submitting && processingIndex >= 0 ? (
              <p className="text-xs" style={{ color: 'rgba(255,215,60,0.55)' }}>
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                Creating listing #{processingIndex + 1} of {slots.length}...
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {slots.filter(s => isSlotValid(s) === null).length} of {slots.length} slots ready
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/sell')}
              style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', background: 'transparent' }}
            >
              <ChevronLeft className="w-4 h-4 mr-1.5" /> Single Listing
            </Button>
            <Button
              onClick={handleSubmitAll}
              disabled={submitting}
              className="navy-gradient text-white border-0 hover:opacity-90 min-w-[180px]"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" /> Create All {slots.length}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

