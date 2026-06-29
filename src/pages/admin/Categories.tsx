import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  Search, Plus, Loader2, RefreshCw, Edit2, X, Save, Trash2,
  Tag, Hash, Palette, FileText, ChevronRight, ChevronDown,
} from 'lucide-react';
import { admin, storage } from '@/lib/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  listing_count: number;
  color: string;
  parent_id: string | null;
  image_url?: string | null;
}

interface EditForm {
  name: string;
  slug: string;
  icon: string;
  color: string;
  parentId: string;
  imageUrl: string;
}

const COLORS = [
  { value: 'text-red-600', label: 'Red', bg: 'bg-red-100' },
  { value: 'text-orange-600', label: 'Orange', bg: 'bg-orange-100' },
  { value: 'text-amber-600', label: 'Amber', bg: 'bg-amber-100' },
  { value: 'text-yellow-600', label: 'Yellow', bg: 'bg-yellow-100' },
  { value: 'text-lime-600', label: 'Lime', bg: 'bg-lime-100' },
  { value: 'text-emerald-600', label: 'Emerald', bg: 'bg-emerald-100' },
  { value: 'text-teal-600', label: 'Teal', bg: 'bg-teal-100' },
  { value: 'text-cyan-600', label: 'Cyan', bg: 'bg-cyan-100' },
  { value: 'text-blue-600', label: 'Blue', bg: 'bg-blue-100' },
  { value: 'text-indigo-600', label: 'Indigo', bg: 'bg-indigo-100' },
  { value: 'text-purple-600', label: 'Purple', bg: 'bg-purple-100' },
  { value: 'text-pink-600', label: 'Pink', bg: 'bg-pink-100' },
  { value: 'text-gray-600', label: 'Gray', bg: 'bg-gray-100' },
  { value: 'text-gray-900', label: 'Dark', bg: 'bg-gray-200' },
];

const ICONS = ['Tag', 'Package', 'ShoppingBag', 'Gamepad2', 'BookOpen', 'Music', 'Camera', 'Heart', 'Star', 'Shirt', 'Laptop', 'Home', 'Car', 'Gem', 'Watch', 'Armchair', 'Sofa', 'UtensilsCrossed', 'Dumbbell', 'Bike', 'Plane', 'Palmtree', 'Sparkles'];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', slug: '', icon: 'Tag', color: 'text-gray-600', parentId: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await admin.categories.list();
      setCategories(data || []);
    } catch {
      toast.error('Failed to load categories');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCategories().finally(() => setLoading(false));
  }, [fetchCategories]);

  // Build category lookup and hierarchy
  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const rootCategories = useMemo(() =>
    categories.filter(c => !c.parent_id),
    [categories]
  );

  const getChildren = useCallback((parentId: string) =>
    categories.filter(c => c.parent_id === parentId),
    [categories]
  );

  // Get all descendant IDs (to exclude from parent selection to prevent circular refs)
  const getDescendantIds = useCallback((catId: string): string[] => {
    const children = getChildren(catId);
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id, ...getDescendantIds(child.id));
    }
    return ids;
  }, [getChildren]);

  const getParentPath = (catId: string | null): string => {
    if (!catId) return '';
    const parent = catMap.get(catId);
    if (!parent) return '';
    const grandparent = getParentPath(parent.parent_id);
    return grandparent ? `${grandparent} > ${parent.name}` : parent.name;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  };

  const openCreate = () => {
    setCreating(true);
    setSelectedCat(null);
    setEditForm({ name: '', slug: '', icon: 'Tag', color: 'text-gray-600', parentId: '', imageUrl: '' });
    setShowDeleteConfirm(false);
  };

  const openEdit = (cat: Category) => {
    setCreating(false);
    setSelectedCat(cat);
    setEditForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || 'Tag',
      color: cat.color || 'text-gray-600',
      parentId: cat.parent_id || '',
      imageUrl: cat.image_url || '',
    });
    setShowDeleteConfirm(false);
  };

  const closePanel = () => {
    setSelectedCat(null);
    setCreating(false);
    setShowDeleteConfirm(false);
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) { toast.error('Category name is required'); return; }
    setSaving(true);
    try {
      if (creating) {
        await admin.categories.create({
          name: editForm.name.trim(),
          slug: editForm.slug || undefined,
          icon: editForm.icon,
          color: editForm.color,
          parent_id: editForm.parentId || null,
        });
        toast.success('Category created');
      } else if (selectedCat) {
        await admin.categories.update(selectedCat.id, {
          name: editForm.name,
          slug: editForm.slug,
          icon: editForm.icon,
          color: editForm.color,
          parent_id: editForm.parentId || null,
          image_url: editForm.imageUrl || null,
        });
        toast.success('Category updated');
      }
      await fetchCategories();
      if (!creating) {
        setSelectedCat(prev => prev ? { ...prev, ...editForm, listing_count: prev.listing_count, parent_id: editForm.parentId || null } : null);
      }
      closePanel();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedCat) return;
    setDeleting(true);
    try {
      await admin.categories.delete(selectedCat.id);
      toast.success('Category deleted');
      await fetchCategories();
      closePanel();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const handleNameChange = (val: string) => {
    setEditForm(f => ({
      ...f,
      name: val,
      slug: creating || !selectedCat ? generateSlug(val) : f.slug,
    }));
  };

  // Build eligible parents (exclude self + descendants to prevent circular refs)
  const eligibleParents = useMemo(() => {
    const excludeIds = new Set<string>();
    if (!creating && selectedCat) {
      excludeIds.add(selectedCat.id);
      getDescendantIds(selectedCat.id).forEach(id => excludeIds.add(id));
    }
    return categories.filter(c => !excludeIds.has(c.id));
  }, [categories, creating, selectedCat, getDescendantIds]);

  // Recursively render a category row with indentation
  const renderCategoryRow = (cat: Category, depth: number = 0) => {
    const children = getChildren(cat.id);
    const isSelected = selectedCat?.id === cat.id;
    const matchesSearch = !search ||
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      cat.slug.toLowerCase().includes(search.toLowerCase());

    // If search is active, show all matching categories flat
    if (search && !matchesSearch) {
      return children.length > 0
        ? children.flatMap(c => renderCategoryRow(c, depth + 1))
        : null;
    }

    const indent = search ? 0 : depth * 20;

    return (
      <Fragment key={cat.id}>
        <tr
          onClick={() => openEdit(cat)}
          className="cursor-pointer group transition-colors"
          style={{
            borderBottom: '1px solid rgba(200,160,60,0.08)',
            background: isSelected ? 'rgba(200,160,60,0.08)' : 'transparent',
            borderLeft: isSelected ? '2px solid rgba(200,160,60,0.55)' : '2px solid transparent',
          }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.05)'; }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3" style={{ paddingLeft: indent }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,160,60,0.12)' }}>
                {depth > 0 && !search ? (
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: '#C8B090' }} />
                ) : (
                  <Tag className="w-4 h-4" style={{ color: '#C68000' }} />
                )}
              </div>
              <div>
                <p className="font-medium text-xs" style={{ color: '#4A3010' }}>{cat.name}</p>
                <p className="text-[11px]" style={{ color: '#B8A070' }}>
                  {cat.listing_count || 0} listing{cat.listing_count !== 1 ? 's' : ''}
                  {cat.parent_id && !search ? ` · ${getParentPath(cat.parent_id)}` : ''}
                </p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5">
            <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,160,60,0.08)', color: '#9A7C40' }}>{cat.slug}</code>
          </td>
          <td className="px-4 py-3.5">
            <span className="text-xs" style={{ color: '#7A5C30' }}>{cat.listing_count || 0}</span>
          </td>
          <td className="px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded border" style={{ background: cat.color?.replace('text-', 'bg-').replace('-600', '-200') || 'bg-gray-100', borderColor: 'rgba(200,160,60,0.20)' }} />
              <span className="text-xs" style={{ color: '#4A3010' }}>{cat.color || 'text-gray-600'}</span>
            </div>
          </td>
          <td className="px-4 py-3.5 text-right">
            <button onClick={e => { e.stopPropagation(); openEdit(cat); }}
              className="p-1.5 rounded-lg transition-colors" style={{ color: '#B8A070' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.10)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
        {!search && children.map(child => renderCategoryRow(child, depth + 1))}
      </Fragment>
    );
  };

  // Render a hierarchical option for the parent selector
  const renderParentOption = (cat: Category, depth: number = 0): React.ReactNode => {
    const children = getChildren(cat.id);
    return (
      <Fragment key={cat.id}>
        <option value={cat.id}>
          {'\u00A0'.repeat(depth * 3)}{depth > 0 ? '└ ' : ''}{cat.name}
        </option>
        {children.map(child => renderParentOption(child, depth + 1))}
      </Fragment>
    );
  };

  const filtered = search
    ? categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.toLowerCase().includes(search.toLowerCase())
      )
    : categories;

  const hasChildren = (catId: string) => categories.some(c => c.parent_id === catId);

  const stats = {
    total: categories.length,
    root: rootCategories.length,
    sub: categories.length - rootCategories.length,
    used: categories.filter(c => c.listing_count > 0).length,
    totalListings: categories.reduce((sum, c) => sum + (c.listing_count || 0), 0),
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
          <h1 className="font-heading text-2xl font-bold" style={{ color: '#2A1A00' }}>Categories</h1>
          <p className="text-sm mt-1" style={{ color: '#9A7C40' }}>{stats.root} top-level · {stats.sub} subcategories · {stats.totalListings} total listings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-lg transition-colors"
            style={{ border: '1px solid rgba(200,160,60,0.15)', color: '#9A7C40' }}>
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.28)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.18)'}>
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Table Panel */}
        <div className={cn('flex-1 min-w-0 transition-all', (selectedCat || creating) ? 'lg:max-w-[calc(100%-420px)]' : '')}>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, highlight: false },
              { label: 'Top-Level', value: stats.root, highlight: false },
              { label: 'Subcategories', value: stats.sub, highlight: false },
              { label: 'With Listings', value: stats.used, highlight: false },
              { label: 'Listings', value: stats.totalListings, highlight: false },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4"
                style={{ background: 'rgba(200,160,60,0.06)', border: s.highlight ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(200,160,60,0.12)' }}>
                <p className="font-bold text-xl font-heading" style={{ color: s.highlight ? 'rgba(252,165,165,0.90)' : '#C68000' }}>{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9A7C40' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B8A070' }} />
            <input type="text" placeholder="Search categories..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 transition-all"
              style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }} />
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(200,160,60,0.06)', border: '1px solid rgba(200,160,60,0.12)' }}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#9A7C40' }} />
                <p className="text-sm" style={{ color: '#9A7C40' }}>{search ? 'No categories match your search' : 'No categories yet'}</p>
                {!search && (
                  <button onClick={openCreate}
                    className="mt-3 text-sm font-medium underline underline-offset-2"
                    style={{ color: '#C68000' }}>
                    Create your first category
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(200,160,60,0.10)', background: 'rgba(200,160,60,0.05)' }}>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Category</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Slug</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Listings</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#9A7C40' }}>Color</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: '#9A7C40' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {search
                      ? filtered.map(cat => renderCategoryRow(cat, 0))
                      : rootCategories.map(cat => renderCategoryRow(cat, 0))
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Edit / Create Panel */}
        {(selectedCat || creating) && (
          <div className="w-[420px] flex-shrink-0 hidden lg:block">
            <div className="rounded-2xl overflow-hidden sticky top-8" style={{ background: 'rgba(200,160,60,0.08)', border: '1px solid rgba(200,160,60,0.16)', backdropFilter: 'blur(20px)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(200,160,60,0.10)', borderBottom: '1px solid rgba(200,160,60,0.15)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,160,60,0.14)' }}>
                    {creating ? <Plus className="w-4 h-4" style={{ color: '#C68000' }} /> : <Edit2 className="w-4 h-4" style={{ color: '#C68000' }} />}
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm" style={{ color: '#2A1A00' }}>{creating ? 'New Category' : 'Edit Category'}</p>
                    <p className="text-[11px]" style={{ color: '#9A7C40' }}>{creating ? 'Create a new listing category' : `ID: ${selectedCat?.id.substring(0, 8)}...`}</p>
                  </div>
                </div>
                <button onClick={closePanel} className="p-1.5 rounded-lg transition-colors" style={{ color: '#9A7C40' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2A1A00'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9A7C40'}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!creating && selectedCat && (
                <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(200,160,60,0.10)' }}>
                  {[
                    { label: 'Listings', value: selectedCat.listing_count || 0 },
                    { label: 'Slug', value: selectedCat.slug || '—' },
                    { label: 'Icon', value: selectedCat.icon || 'Tag' },
                  ].map(s => (
                    <div key={s.label} className="px-4 py-3 text-center" style={{ borderRight: '1px solid rgba(200,160,60,0.10)' }}>
                      <p className="font-bold text-sm" style={{ color: '#2A1A00' }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#B8A070' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Parent Category */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Parent Category</label>
                  <div className="relative">
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <select value={editForm.parentId} onChange={e => setEditForm(f => ({ ...f, parentId: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all appearance-none"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}>
                      <option value="">— Top-Level Category —</option>
                      {rootCategories.map(cat => renderParentOption(cat, 0))}
                    </select>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#C8B090' }}>Leave empty for a top-level category</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Name *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <input value={editForm.name} onChange={e => handleNameChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                      placeholder="e.g. Helmet" />
                  </div>
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Slug</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <input value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                      placeholder="Auto-generated from name" />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#C8B090' }}>Leave empty for auto-generation</p>
                </div>

                {/* Icon */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(icon => (
                      <button key={icon} type="button" onClick={() => setEditForm(f => ({ ...f, icon }))}
                        className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all border text-xs', editForm.icon === icon
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-transparent text-gray-500')}
                        style={editForm.icon === icon
                          ? { background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.40)', color: '#C68000' }
                          : { background: 'rgba(200,160,60,0.06)', color: '#9A7C40' }}
                        title={icon}>
                        {icon.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <input value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full mt-2 px-3 py-2 text-xs rounded-lg focus:outline-none"
                    style={{ background: 'rgba(200,160,60,0.08)', border: '1px solid rgba(200,160,60,0.12)', color: '#4A3010' }}
                    placeholder="Or type icon name" />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c.value} type="button" onClick={() => setEditForm(f => ({ ...f, color: c.value }))}
                        className={cn('w-9 h-9 rounded-lg transition-all flex items-center justify-center text-[10px] font-bold border')}
                        style={{
                          background: editForm.color === c.value ? c.bg : 'rgba(200,160,60,0.06)',
                          border: editForm.color === c.value ? '2px solid rgba(200,160,60,0.50)' : '1px solid rgba(200,160,60,0.12)',
                          color: c.value,
                        }}
                        title={c.label}>
                        {c.label.substring(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Cover Image</label>
                  {editForm.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden mb-2">
                      <img src={editForm.imageUrl} alt="Category cover"
                        className="w-full h-32 object-cover rounded-xl"
                        style={{ border: '1px solid rgba(200,160,60,0.15)' }} />
                      <button type="button" onClick={() => setEditForm(f => ({ ...f, imageUrl: '' }))}
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 backdrop-blur-sm transition-all hover:bg-white"
                        style={{ border: '1px solid rgba(200,160,60,0.20)', color: '#9A7C40' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl cursor-pointer transition-all"
                      style={{ background: 'rgba(200,160,60,0.06)', border: '1px dashed rgba(200,160,60,0.25)', color: '#9A7C40' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,160,60,0.45)'; (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.10)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,160,60,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,60,0.06)'; }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(200,160,60,0.12)', border: '1px solid rgba(200,160,60,0.20)' }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <span className="text-xs font-medium">Click to upload cover image</span>
                      <span className="text-[10px]">Shown as background in Browse by Category section</span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const result = await storage.upload(file);
                            setEditForm(f => ({ ...f, imageUrl: result.url }));
                            toast.success('Image uploaded');
                          } catch {
                            toast.error('Failed to upload image');
                          }
                          e.target.value = '';
                        }} />
                    </label>
                  )}
                  <p className="text-[10px] mt-1" style={{ color: '#C8B090' }}>Recommended: 1200×600px or similar landscape ratio</p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={saving || !editForm.name.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.28)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.18)'}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {creating ? 'Create Category' : 'Save Changes'}
                  </button>
                  <button onClick={closePanel}
                    className="px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#8A6C40' }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.15)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.10)'}>
                    Cancel
                  </button>
                </div>

                {/* Delete (only for existing categories) */}
                {!creating && selectedCat && (
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(200,160,60,0.10)' }}>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm transition-all"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgba(252,165,165,0.85)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'}>
                        <Trash2 className="w-4 h-4" /> Delete Category
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-center" style={{ color: 'rgba(252,165,165,0.85)' }}>
                          Are you sure? This cannot be undone.
                          {hasChildren(selectedCat.id) && (
                            <span className="block mt-1" style={{ color: 'rgba(251,191,36,0.85)' }}>
                              ⚠ This category has subcategories.
                            </span>
                          )}
                          {selectedCat.listing_count > 0 && (
                            <span className="block mt-1" style={{ color: 'rgba(251,191,36,0.85)' }}>
                              ⚠ This category has {selectedCat.listing_count} listing{selectedCat.listing_count !== 1 ? 's' : ''}.
                            </span>
                          )}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={handleDelete} disabled={deleting}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', color: 'rgba(252,165,165,0.90)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.25)'}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'}>
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete
                          </button>
                          <button onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2 rounded-xl text-sm transition-all"
                            style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#8A6C40' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Edit/Create Panel Modal */}
        {(selectedCat || creating) && (
          <div className="fixed inset-0 z-50 flex flex-col lg:hidden" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)' }}>
            <div className="flex-1 overflow-y-auto m-4 rounded-2xl" style={{ background: '#FFFDF5', border: '1px solid rgba(200,160,60,0.20)', boxShadow: '0 32px 100px rgba(0,0,0,0.40)' }}>
              <div className="px-5 py-4 flex items-center justify-between sticky top-0 z-10" style={{ background: '#FFFDF5', borderBottom: '1px solid rgba(200,160,60,0.15)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200,160,60,0.14)' }}>
                    {creating ? <Plus className="w-4 h-4" style={{ color: '#C68000' }} /> : <Edit2 className="w-4 h-4" style={{ color: '#C68000' }} />}
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm" style={{ color: '#2A1A00' }}>{creating ? 'New Category' : 'Edit Category'}</p>
                    <p className="text-[11px]" style={{ color: '#9A7C40' }}>{creating ? 'Create a new listing category' : `ID: ${selectedCat?.id.substring(0, 8)}...`}</p>
                  </div>
                </div>
                <button onClick={closePanel} className="p-1.5 rounded-lg transition-colors" style={{ color: '#9A7C40' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2A1A00'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9A7C40'}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!creating && selectedCat && (
                <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(200,160,60,0.10)' }}>
                  {[
                    { label: 'Listings', value: selectedCat.listing_count || 0 },
                    { label: 'Slug', value: selectedCat.slug || '—' },
                    { label: 'Icon', value: selectedCat.icon || 'Tag' },
                  ].map(s => (
                    <div key={s.label} className="px-4 py-3 text-center" style={{ borderRight: '1px solid rgba(200,160,60,0.10)' }}>
                      <p className="font-bold text-sm" style={{ color: '#2A1A00' }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#B8A070' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Parent Category</label>
                  <div className="relative">
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <select value={editForm.parentId} onChange={e => setEditForm(f => ({ ...f, parentId: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all appearance-none"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}>
                      <option value="">— Top-Level Category —</option>
                      {rootCategories.map(cat => renderParentOption(cat, 0))}
                    </select>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#C8B090' }}>Leave empty for a top-level category</p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Name *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <input value={editForm.name} onChange={e => handleNameChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                      placeholder="e.g. Helmet" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Slug</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#B8A070' }} />
                    <input value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#4A3010' }}
                      placeholder="Auto-generated from name" />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: '#C8B090' }}>Leave empty for auto-generation</p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(icon => (
                      <button key={icon} type="button" onClick={() => setEditForm(f => ({ ...f, icon }))}
                        className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all border text-xs', editForm.icon === icon
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-transparent text-gray-500')}
                        style={editForm.icon === icon
                          ? { background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.40)', color: '#C68000' }
                          : { background: 'rgba(200,160,60,0.06)', color: '#9A7C40' }}
                        title={icon}>
                        {icon.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <input value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full mt-2 px-3 py-2 text-xs rounded-lg focus:outline-none"
                    style={{ background: 'rgba(200,160,60,0.08)', border: '1px solid rgba(200,160,60,0.12)', color: '#4A3010' }}
                    placeholder="Or type icon name" />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#9A7C40' }}>Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c.value} type="button" onClick={() => setEditForm(f => ({ ...f, color: c.value }))}
                        className={cn('w-9 h-9 rounded-lg transition-all flex items-center justify-center text-[10px] font-bold border')}
                        style={{
                          background: editForm.color === c.value ? c.bg : 'rgba(200,160,60,0.06)',
                          border: editForm.color === c.value ? '2px solid rgba(200,160,60,0.50)' : '1px solid rgba(200,160,60,0.12)',
                          color: c.value,
                        }}
                        title={c.label}>
                        {c.label.substring(0, 2)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex gap-3">
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: 'rgba(200,160,60,0.18)', border: '1px solid rgba(200,160,60,0.35)', color: '#C68000' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.28)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.18)'}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : creating ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      {creating ? 'Create Category' : 'Save Changes'}
                    </button>
                    <button onClick={closePanel}
                      className="px-4 py-2.5 rounded-xl text-sm transition-all"
                      style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#8A6C40' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.15)'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,160,60,0.10)'}>
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Delete (only for existing categories) */}
                {!creating && selectedCat && (
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(200,160,60,0.10)' }}>
                    {!showDeleteConfirm ? (
                      <button onClick={() => setShowDeleteConfirm(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm transition-all"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: 'rgba(252,165,165,0.85)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'}>
                        <Trash2 className="w-4 h-4" /> Delete Category
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-center" style={{ color: 'rgba(252,165,165,0.85)' }}>
                          Are you sure? This cannot be undone.
                          {hasChildren(selectedCat.id) && (
                            <span className="block mt-1" style={{ color: 'rgba(251,191,36,0.85)' }}>⚠ This category has subcategories.</span>
                          )}
                          {selectedCat.listing_count > 0 && (
                            <span className="block mt-1" style={{ color: 'rgba(251,191,36,0.85)' }}>⚠ This category has {selectedCat.listing_count} listing{selectedCat.listing_count !== 1 ? 's' : ''}.</span>
                          )}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={handleDelete} disabled={deleting}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', color: 'rgba(252,165,165,0.90)' }}>
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                          </button>
                          <button onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2 rounded-xl text-sm transition-all"
                            style={{ background: 'rgba(200,160,60,0.10)', border: '1px solid rgba(200,160,60,0.15)', color: '#8A6C40' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

