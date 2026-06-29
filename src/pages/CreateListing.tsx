import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, X, Plus, ChevronRight, ChevronLeft, Image as ImageIcon,
  Tag, DollarSign, MapPin, FileText, CheckCircle, Loader2, ShieldCheck, User
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { fetchCategories, createListing } from '@/lib/api';
import { admin, storage as storageClient } from '@/lib/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CONDITIONS = [
  { value: 'new', label: 'Brand New', description: 'Unopened, unused, original packaging' },
  { value: 'like-new', label: 'Like New', description: 'Barely used, no visible wear' },
  { value: 'good', label: 'Good', description: 'Minor wear, fully functional' },
  { value: 'fair', label: 'Fair', description: 'Visible wear, works well' },
  { value: 'poor', label: 'Well Used', description: 'Heavy wear, still functional' },
] as const;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'];

const STEPS = ['Details', 'Photos', 'Pricing', 'Review'];

interface FormData {
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

export default function CreateListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; username: string; email: string }[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  // Admin can pick which user the listing belongs to
  useEffect(() => {
    if (user?.role === 'admin') {
      admin.users.list().then((data: any[]) => {
        const list = data.map((u: any) => ({ id: u.id, username: u.username || u.email?.split('@')[0] || 'Unknown', email: u.email }));
        setSellers(list);
      }).catch(() => {});
    }
  }, [user?.role]);

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    categoryId: '',
    condition: 'good',
    location: '',
    price: '',
    currency: 'USD',
    images: [],
    imageUrls: [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const updateField = (field: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ─── Image Handling ──────────────────────────────────────────

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) toast.warning('Some files exceeded 10 MB and were skipped');

    const previews = valid.map(f => URL.createObjectURL(f));
    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...valid].slice(0, 8),
      imageUrls: [...prev.imageUrls, ...previews].slice(0, 8),
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idx: number) => {
    setForm(prev => {
      const removed = prev.imageUrls[idx];
      if (removed) URL.revokeObjectURL(removed);
      return {
        ...prev,
        images: prev.images.filter((_, i) => i !== idx),
        imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
      };
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!user || form.images.length === 0) return [];
    setUploadingImages(true);
    const uploaded: string[] = [];

    for (const file of form.images) {
      try {
        const result = await storageClient.upload(file);
        uploaded.push(result.url);
      } catch (err) {
        console.error('Image upload error:', err);
      }
    }
    setUploadingImages(false);
    return uploaded;
  };

  // ─── Validation ───────────────────────────────────────────────

  const isStepValid = () => {
    if (step === 0) return form.title.trim().length >= 5 && form.description.trim().length >= 20 && form.categoryId && form.condition && form.location.trim();
    if (step === 1) return form.images.length >= 1;
    if (step === 2) return Number(form.price) > 0 && form.currency;
    return true;
  };

  // ─── Submit ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);

    try {
      const imagePublicUrls = await uploadImages();

      const listing = await createListing({
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        condition: form.condition as any,
        location: form.location.trim(),
        price: Number(form.price),
        currency: form.currency,
        images: imagePublicUrls,
        sellerId: selectedSellerId || user.id,
      });

      toast.success('Listing published successfully!');
      navigate(`/listing/${listing.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  // Only admins can create listings
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen" style={{ background: '#FFFDF5' }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(255,224,0,0.10)', border: '1px solid rgba(255,224,0,0.22)' }}>
            <ShieldCheck className="w-8 h-8" style={{ color: 'rgba(255,224,0,0.75)' }} />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-3" style={{ color: 'rgba(255,255,255,0.90)' }}>Listings are Admin-Managed</h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.50)' }}>
            On SafeEscrow, all listings are curated and published by our admin team to ensure quality and authenticity.
            Buyers browse and purchase through the secure escrow system.
          </p>
          <div className="rounded-2xl p-5 mb-6 text-left space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.40)' }}>What you can do</p>
            {[
              'Browse hundreds of verified listings on the marketplace',
              'Purchase items securely through the escrow system',
              'Message sellers directly about any listing',
              'Track all your transactions from your dashboard',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <CheckCircle className="w-3 h-3" style={{ color: 'rgba(52,211,153,0.80)' }} />
                </div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.62)' }}>{item}</p>
              </div>
            ))}
          </div>
          <Button
            onClick={() => navigate('/marketplace')}
            className="navy-gradient text-white border-0 hover:opacity-90"
          >
            Browse Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const selectedCategory = categories.find(c => c.id === form.categoryId);

  return (
    <div className="min-h-screen" style={{ background: '#000000' }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.90)' }}>Create a Listing</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>List your item for sale with escrow protection</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={
                    idx < step
                      ? { background: 'rgba(255,215,60,0.90)', color: '#090907' }
                      : idx === step
                      ? { background: 'rgba(255,215,60,0.20)', border: '2px solid rgba(255,215,60,0.65)', color: 'rgba(255,235,100,0.95)' }
                      : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.38)' }
                  }
                >
                  {idx < step ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className="text-[10px] mt-1 font-medium hidden sm:block"
                  style={idx === step ? { color: 'rgba(255,215,60,0.85)' } : idx < step ? { color: 'rgba(255,215,60,0.55)' } : { color: 'rgba(255,255,255,0.30)' }}
                >{label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className="flex-1 h-0.5 mx-2 -mt-4 sm:-mt-6 transition-all rounded-full"
                  style={{ background: idx < step ? 'rgba(255,215,60,0.55)' : 'rgba(255,255,255,0.10)' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,60,0.12)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

          {/* STEP 0: Details */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder="e.g. Apple MacBook Pro 16-inch M3 Max"
                  maxLength={120}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{form.title.length}/120 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe your item in detail — condition, features, included accessories, reason for selling..."
                  rows={5}
                  maxLength={2000}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 transition-all resize-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{form.description.length}/2000</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Category <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateField('categoryId', cat.id)}
                      className="px-3 py-2 rounded-xl text-xs font-medium transition-all text-left flex items-center gap-2"
                      style={form.categoryId === cat.id
                        ? { background: 'rgba(255,215,60,0.15)', border: '1px solid rgba(255,215,60,0.35)', color: 'rgba(255,235,100,0.90)' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.48)' }}
                    >
                      <Tag className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Condition <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {CONDITIONS.map(cond => (
                    <label
                      key={cond.value}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={form.condition === cond.value
                        ? { background: 'rgba(255,215,60,0.10)', border: '1px solid rgba(255,215,60,0.30)' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                    >
                      <input
                        type="radio"
                        name="condition"
                        value={cond.value}
                        checked={form.condition === cond.value}
                        onChange={() => updateField('condition', cond.value)}
                        className="accent-[hsl(var(--brand-navy))]"
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: form.condition === cond.value ? 'rgba(255,235,100,0.90)' : 'rgba(255,255,255,0.78)' }}>
                          {cond.label}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>{cond.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <MapPin className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => updateField('location', e.target.value)}
                  placeholder="e.g. New York, NY"
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                />
              </div>
            </div>
          )}

          {/* STEP 1: Photos */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-heading font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.88)' }}>Item Photos</h2>
                <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.42)' }}>Add up to 8 photos. First photo is your main listing image. Max 10MB each.</p>

                {/* Upload area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl p-8 text-center cursor-pointer transition-all"
                  style={{ border: '2px dashed rgba(255,215,60,0.20)', background: 'rgba(255,215,60,0.03)' }}
                >
                  <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,215,60,0.45)' }} />
                  <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.78)' }}>Click to upload photos</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>JPG, PNG, WebP — up to 10MB each</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>{form.images.length}/8 photos added</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFilePick}
                  className="hidden"
                />

                {/* Preview grid */}
                {form.imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                    {form.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <div className="absolute bottom-1.5 left-1.5 bg-[hsl(var(--brand-navy))] text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            Main
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {form.images.length < 8 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-muted flex flex-col items-center justify-center text-muted-foreground hover:border-[hsl(var(--brand-navy))]/50 hover:text-[hsl(var(--brand-navy))] transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] mt-1">Add</span>
                      </button>
                    )}
                  </div>
                )}

                {form.images.length === 0 && (
                  <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <ImageIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700">At least 1 photo is required to publish your listing</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Pricing */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <DollarSign className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                  Asking Price <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.currency}
                    onChange={e => updateField('currency', e.target.value)}
                    className="px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)' }}
                  >
                    {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#111', color: '#eee' }}>{c}</option>)}
                  </select>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => updateField('price', e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                  />
                </div>
              </div>

              {Number(form.price) > 0 && (
                <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>Listing Price</span>
                    <span className="font-medium" style={{ color: 'rgba(255,255,255,0.82)' }}>{form.currency} {Number(form.price).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.45)' }}>Platform Fee (2%)</span>
                    <span className="font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>− {form.currency} {(Number(form.price) * 0.02).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>You receive</span>
                    <span className="font-bold" style={{ color: 'rgba(255,215,60,0.85)' }}>
                      {form.currency} {(Number(form.price) * 0.98).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Escrow Payment Protection</p>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      Buyer funds are held securely in escrow until you fulfill all steps: item verification, packaging approval, and successful delivery confirmed by the buyer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-heading font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>Review Your Listing</h2>

              {/* Main image preview */}
              {form.imageUrls[0] && (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                  <img src={form.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <p className="font-heading font-bold text-white text-lg leading-tight">{form.title}</p>
                    <p className="text-white/80 text-sm mt-1">{form.currency} {Number(form.price).toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Category', value: selectedCategory?.name || '—' },
                  { label: 'Condition', value: CONDITIONS.find(c => c.value === form.condition)?.label || '—' },
                  { label: 'Location', value: form.location || '—' },
                  { label: 'Photos', value: `${form.images.length} image${form.images.length !== 1 ? 's' : ''}` },
                  { label: 'Price', value: `${form.currency} ${Number(form.price).toLocaleString()}` },
                  { label: 'You Receive', value: `${form.currency} ${(Number(form.price) * 0.97).toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
                    <p className="font-medium mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.82)' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Description Preview</p>
                <p className="text-sm line-clamp-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{form.description}</p>
              </div>

              {user?.role === 'admin' && (
                <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,60,0.25)' }}>
                  <label className="block text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,235,100,0.85)' }}>
                    <User className="w-3.5 h-3.5" /> Assign This Listing To
                  </label>
                  <select
                    value={selectedSellerId}
                    onChange={e => setSelectedSellerId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 transition-all"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                  >
                    <option value="">Myself (admin)</option>
                    {sellers.filter(s => s.id !== user.id).map(s => (
                      <option key={s.id} value={s.id}>{s.username} ({s.email})</option>
                    ))}
                  </select>
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    The selected user will appear as the seller of this listing
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl p-3">
                <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p>By publishing, you agree that all information is accurate. Misrepresentation may lead to account suspension.</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => step === 0 ? navigate('/marketplace') : setStep(s => s - 1)}
            className="flex items-center gap-2"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.65)', background: 'transparent' }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!isStepValid()}
              className="navy-gradient text-white border-0 hover:opacity-90 flex items-center gap-2"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploadingImages}
              className="navy-gradient text-white border-0 hover:opacity-90 flex items-center gap-2 min-w-[160px]"
            >
              {submitting || uploadingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadingImages ? 'Uploading images…' : 'Publishing…'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Publish Listing
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
