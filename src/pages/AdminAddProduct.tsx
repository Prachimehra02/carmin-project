import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, AlertCircle, CheckCircle, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { CategorySelector } from '../components/CategorySelector';
import { supabase } from '../lib/supabase';
import type { HsnMaster } from '../types/product';
import { fetchActiveAttributes, type AttributeTypeWithValues, } from '../services/attributeService';
import {
  type Tag,
  generateSlug as generateTagSlug,
  fetchAllTags, createTag, updateTag, checkForDuplicates,
} from '../services/tagService';

interface FormData {
  name: string;
  slug: string;
  category_id: number | null;
  sku: string;
  
  hsn_id: string;
  hsn_code: string;
  gst_percentage: string;
  description: string;
 
  badge?: string;
  
  featured: boolean;
  is_active: boolean;
  meta_title: string;
  meta_description: string;
  
}

type ProductStatus = 'draft' | 'published';
interface ProductImage { url: string; mediaId: string }
interface VariantRow {
  key: string;
  attributeValueIds: number[];
  buyingPrice: string;
  mrp: string;
  discountPercentage: string;
  sellingPrice: string;
  stock: string;
  images: ProductImage[];
  weight: string;
  length: string;
  width: string;
  height: string;
}

// Browser-local autosave protects unsaved work when navigating between admin tabs.
const DRAFT_KEY = 'carmin:add-product:unsaved:v3';

const DRAFT_EXPIRY_HOURS = 24;

const DRAFT_EXPIRY_MS =
  DRAFT_EXPIRY_HOURS * 60 * 60 * 1000;

const readDraft = (): Record<string, any> | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw);

    if (
      !Number.isFinite(draft.updatedAt) ||
      Date.now() - draft.updatedAt > DRAFT_EXPIRY_MS
    ) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};

interface Collection {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const [initialDraft] = useState(() => readDraft());
  const [form, setForm] = useState<FormData>(() => ({
    name: '',
    slug: '',
    category_id: null,
    sku: '',
    
    hsn_id: '',
    hsn_code: '',
    gst_percentage: '',
    description: '',
   
    badge: '',
    
    featured: false,
    is_active: false,
    meta_title: '',
    meta_description: '',
    
    ...initialDraft?.form,
  }));
  const [variantTypeIds, setVariantTypeIds] = useState<number[]>((initialDraft?.variantTypeIds ?? []));
  const [attributeSearch, setAttributeSearch] = useState('');
  const [sharedSearch, setSharedSearch] = useState('');
  const [draftVariantValues, setDraftVariantValues] = useState<Record<number, number>>((initialDraft?.draftVariantValues ?? {}));
  const [expandedVariantKey, setExpandedVariantKey] = useState<string | null>('base');
  const [variants, setVariants] = useState<VariantRow[]>(initialDraft?.variants?.length ? initialDraft.variants : [{ key: 'base', attributeValueIds: [], buyingPrice: '', mrp: '', discountPercentage: '0', sellingPrice: '', stock: '0', images: [], weight: '', length: '', width: '', height: '' }]);
  const [defaultVariantKey, setDefaultVariantKey] = useState<string>(initialDraft?.defaultVariantKey ?? 'base');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hsnList, setHsnList] = useState<HsnMaster[]>([]);
  const [hsnSearch, setHsnSearch] = useState('');
  const [hsnDropdownOpen, setHsnDropdownOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>((initialDraft?.selectedCollectionIds ?? []));
  
  const [attributeTypes, setAttributeTypes] = useState<AttributeTypeWithValues[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<number, number>>((initialDraft?.selectedAttributes ?? {}));
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>((initialDraft?.selectedTagIds ?? []));
  const [tagSearch, setTagSearch] = useState('');
  const [tagAction, setTagAction] = useState<
    | { mode: 'confirm-create'; name: string; slug: string }
    | { mode: 'confirm-reactivate'; tag: Tag }
    | { mode: 'confirm-similar-active'; name: string; slug: string; tag: Tag }
    | { mode: 'confirm-similar-inactive'; name: string; slug: string; tag: Tag }
    | null
  >(null);
  const [tagProcessing, setTagProcessing] = useState(false);

  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
  if (success) return;

  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        form,
        variants,
        variantTypeIds,
        draftVariantValues,
        defaultVariantKey,
        selectedCollectionIds,
        selectedAttributes,
        selectedTagIds,
        updatedAt: Date.now(),
      })
    );
  } catch (err) {
    console.warn('Could not autosave product draft', err);
  }
}, [
  form,
  variants,
  variantTypeIds,
  draftVariantValues,
  defaultVariantKey,
  selectedCollectionIds,
  selectedAttributes,
  selectedTagIds,
  success
]);

  const discardLocalDraft = () => {
    if (!window.confirm('Discard this unsaved product and clear its locally saved draft?')) return;
    localStorage.removeItem(DRAFT_KEY);
    window.location.reload();
  };

  const fetchHsnList = async () => {
    const { data, error } = await supabase
      .from('hsn_master')
      .select('*')
      .eq('is_active', true)
      .order('hsn_code');

    if (error) {
      console.error('Error fetching HSN master:', error);
      return;
    }

    setHsnList(data || []);
  };

  const fetchCollections = async () => {
  const { data, error } = await supabase
    .from('collections')
    .select('id, name')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Failed to load collections:', error);
    return;
  }

  setCollections(data || []);
};

  const fetchProductMetadata = async () => {
  try {
    setMetadataLoading(true);
    setMetadataError(null);

    const [attributesData, tagsData] = await Promise.all([
      fetchActiveAttributes(),
      fetchAllTags(),
    ]);

    setAttributeTypes(attributesData);
    setTags(tagsData);
  } catch (err) {
    setMetadataError(
      err instanceof Error
        ? err.message
        : 'Failed to load product attributes and tags'
    );
  } finally {
    setMetadataLoading(false);
  }
};

  useEffect(() => {
    fetchHsnList();
    fetchCollections();
    fetchProductMetadata();
    }, []);

  const handleCategoryChange = async (categoryId: number | null) => {
    setForm(prev => ({ ...prev, category_id: categoryId, sku: '' }));
    if (!categoryId) return;

    const { data, error } = await supabase.rpc('preview_next_sku_v2', {
      p_category_id: categoryId,
    });

    if (!error && data) {
      setForm(prev => ({ ...prev, sku: data as string }));
    }
  };

  const handleHsnSelect = (hsn: HsnMaster) => {
    setForm(prev => ({
      ...prev,
      hsn_id: hsn.id,
      hsn_code: hsn.hsn_code,
      gst_percentage: String(hsn.gst_percentage),
    }));
    setHsnSearch('');
    setHsnDropdownOpen(false);
  };

  const handleHsnSearchChange = (value: string) => {
    setHsnSearch(value);
    setHsnDropdownOpen(true);
    if (value === '') {
      setForm(prev => ({ ...prev, hsn_id: '', hsn_code: '', gst_percentage: '' }));
    }
  };

  const filteredHsn = hsnList.filter((h) =>
    h.hsn_code.toLowerCase().includes(hsnSearch.toLowerCase()) ||
    h.description.toLowerCase().includes(hsnSearch.toLowerCase())
  );

  const filteredTagOptions = tags.filter(
    (tag) =>
      tag.active &&
      !selectedTagIds.includes(tag.id) &&
      (tag.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
        tag.slug.toLowerCase().includes(tagSearch.toLowerCase()))
  );

  const handleCreateTagFromSearch = async () => {
    const trimmed = tagSearch.trim();
    if (!trimmed) return;
    const slug = generateTagSlug(trimmed);

    setTagAction(null);

    // Recheck against the latest DB state before taking action
    let allTags: Tag[];
    try {
      allTags = await fetchAllTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check existing tags');
      return;
    }
    setTags(allTags);

    const check = checkForDuplicates(trimmed, slug, allTags);

    if (check.isExactName || check.isExactSlug) {
      const existing = check.exactMatchTag!;
      if (existing.active) {
        // Exact active tag — just select it
        setSelectedTagIds((prev) => [...prev, existing.id]);
        setTagSearch('');
        return;
      }
      // Exact inactive tag — offer to reactivate
      setTagAction({ mode: 'confirm-reactivate', tag: existing });
      return;
    }

    if (check.similarTag) {
      if (check.similarTag.active) {
        setTagAction({ mode: 'confirm-similar-active', name: trimmed, slug, tag: check.similarTag });
      } else {
        setTagAction({ mode: 'confirm-similar-inactive', name: trimmed, slug, tag: check.similarTag });
      }
      return;
    }

    // No duplicates at all — create directly
    await doCreateTag(trimmed, slug);
  };

  const doCreateTag = async (name: string, slug: string) => {
    setTagProcessing(true);
    setError(null);
    try {
      const created = await createTag({ name, slug, active: true });
      setTags((prev) => [...prev, created]);
      setSelectedTagIds((prev) => [...prev, created.id]);
      setTagSearch('');
      setTagAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setTagProcessing(false);
    }
  };

  const doReactivateTag = async (tag: Tag) => {
    setTagProcessing(true);
    setError(null);
    try {
      await updateTag(tag.id, { active: true });
      const updated = { ...tag, active: true };
      setTags((prev) => prev.map((t) => (t.id === tag.id ? updated : t)));
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setTagSearch('');
      setTagAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate tag');
    } finally {
      setTagProcessing(false);
    }
  };

  const selectTag = (tag: Tag) => {
    setSelectedTagIds((prev) => [...prev, tag.id]);
    setTagSearch('');
    setTagAction(null);
  };

  // Pricing is bidirectional: discount edits recalculate selling price,
  // while selling-price edits recalculate discount. 0% means no discount.
  const calculatePricing = (
    current: { mrp: string; discountPercentage: string; sellingPrice: string },
    field: 'mrp' | 'discountPercentage' | 'sellingPrice',
    value: string
  ) => {
    const next = { ...current, [field]: value };
    const mrp = Number(next.mrp);
    if (field === 'sellingPrice') {
      if (next.mrp !== '' && mrp > 0 && value !== '' && Number.isFinite(Number(value))) {
        const percent = ((mrp - Number(value)) / mrp) * 100;
        next.discountPercentage = (Math.round(percent * 100) / 100).toString();
      } else {
        next.discountPercentage = '';
      }
    } else if (next.mrp !== '' && mrp > 0) {
      // Blank discount is treated as 0%, the default when entering an MRP.
      const discount = next.discountPercentage === '' ? 0 : Number(next.discountPercentage);
      if (Number.isFinite(discount)) {
        next.sellingPrice = (mrp * (1 - discount / 100)).toFixed(2);
        if (next.discountPercentage === '') next.discountPercentage = '0';
      }
    } else {
      next.sellingPrice = '';
    }
    return next;
  };

  const updateVariantPricing = (
    key: string,
    field: 'mrp' | 'discountPercentage' | 'sellingPrice',
    value: string
  ) => {
    setVariants(prev => prev.map(v => v.key === key
      ? { ...v, ...calculatePricing(v, field, value) }
      : v));
  };

  const handleInputChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => {
  const { name, value, type } = e.target;

  if (type === 'checkbox') {
    setForm(prev => ({
      ...prev,
      [name]: (e.target as HTMLInputElement).checked,
    }));
    return;
  }

  setForm(prev => ({
    ...prev,
    [name]: value,
  }));

  setError(null);
};

  const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const name = e.target.value;

  setForm(prev => ({
    ...prev,
    name,
    slug: generateSlug(name),
    meta_title: name,
  }));
};

  const updateVariant = (key: string, patch: Partial<VariantRow>) => {
    setVariants(prev => prev.map(v => v.key === key ? { ...v, ...patch } : v));
  };

  const assignFirstVariant = () => {
    if (!variantTypeIds.length) { setError('Select a variant attribute first'); return; }
    const ids = variantTypeIds.map(typeId => draftVariantValues[typeId]);
    if (ids.some(id => !id)) { setError('Choose one value for each variant attribute'); return; }
    const key = [...ids].sort((a,b) => a-b).join(',');
    if (variants.some(v => v.key !== 'base' && v.key === key)) { setError('Combination already exists'); return; }
    setVariants(prev => prev.map(v => v.key === 'base' ? {...v, attributeValueIds: [...ids].sort((a,b)=>a-b)} : v));
    setError(null);
  };

  const addVariant = () => {
    if (variantTypeIds.length === 0) {
      setError('Add at least one variant attribute first'); return;
    }
    const ids = variantTypeIds.map(typeId => draftVariantValues[typeId]);
    if (ids.some(id => !id)) {
      setError('Choose one value for every selected variant attribute'); return;
    }
    const sorted = [...ids].sort((a, b) => a - b);
    const key = sorted.join(',');
    if (variants.some(v => v.key === key || (v.key === 'base' && v.attributeValueIds.join(',') === key))) {
      setError('This variant already exists'); return;
    }
    if (variants.length >= 100) {
      setError('Maximum 100 variants per product'); return;
    }
    const next: VariantRow = {
      key, attributeValueIds: sorted, buyingPrice: '', mrp: '',
      discountPercentage: '0', sellingPrice: '', stock: '0', images: [],
      weight: '', length: '', width: '', height: '',
    };
    setVariants(prev => [...prev, next]);
    setDefaultVariantKey(prev => prev || 'base');
    setExpandedVariantKey(key);
    setError(null);
  };

  const removeVariant = (key: string) => {
    if (key === 'base') { setError('The original variant cannot be removed'); return; }
    setVariants(prev => prev.filter(v => v.key !== key));
    setDefaultVariantKey(prev => prev === key ? (variants.find(v => v.key !== key)?.key || '') : prev);
    setExpandedVariantKey(prev => prev === key ? null : prev);
  };

  const valueName = (id: number) => attributeTypes
    .flatMap(t => t.attribute_values).find(v => v.id === id)?.value ?? String(id);

  const handleVariantImageUpload = async (key: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB'); return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `product-images/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('products').getPublicUrl(path);
      const { data: asset, error: assetError } = await supabase.from('media_assets').insert({
        file_name: file.name, storage_bucket: 'products', storage_path: path,
        public_url: urlData.publicUrl, file_size: file.size, mime_type: file.type,
      }).select('id').single();
      if (assetError || !asset) {
        await supabase.storage.from('products').remove([path]);
        throw assetError ?? new Error('Failed to register image');
      }
      setVariants(prev => prev.map(v => v.key === key ? {
        ...v, images: [...v.images, { url: urlData.publicUrl, mediaId: asset.id }],
      } : v));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variant image upload failed');
    } finally { setUploading(false); }
  };

  const handleSubmit = async (productStatus: ProductStatus) => {
    setError(null);
    if (!form.category_id) { setError('Please select a category'); return; }
    if (!form.name.trim()) { setError('Product name is required'); return; }
    if (productStatus === 'published' && !form.hsn_id) { setError('HSN code is required before publishing'); return; }
    if (productStatus === 'published' && !form.description.trim()) {
      setError('Description is required before publishing'); return;
    }
    
    if (variants.length === 0) {
      setError('Add at least one variant before saving'); return;
    }
    const optionIds = [...new Set(variants.flatMap(v => v.attributeValueIds))];
    if (variantTypeIds.length > 0 && variants.some(v =>
      v.attributeValueIds.length !== variantTypeIds.length ||
      variantTypeIds.some(typeId => !v.attributeValueIds.some(id =>
        attributeTypes.find(t => t.id === typeId)?.attribute_values.some(value => value.id === id)
      ))
    )) {
      setError('Each variant must have a value for every selected variant attribute'); return;
    }
    const selected = variants;
    for (const row of selected) {
      const hasPrice = row.mrp !== '' || row.sellingPrice !== '' || row.buyingPrice !== '';
       const discount = Number(row.discountPercentage || '0');
      if (productStatus === 'published' && (!row.mrp || !row.sellingPrice || !row.images.length)) {
        setError('Published products require pricing and at least one image'); return;
      }
      if (row.buyingPrice !== '' && (!Number.isFinite(Number(row.buyingPrice)) || Number(row.buyingPrice) < 0)) { setError('Buying price must be a non-negative number'); return; }
      if (hasPrice && (!row.mrp || !row.sellingPrice ||
          !Number.isFinite(Number(row.mrp)) || !Number.isFinite(Number(row.sellingPrice)) ||
          Number(row.mrp) <= 0 || Number(row.sellingPrice) < 0 ||
          Number(row.sellingPrice) > Number(row.mrp) ||
           !Number.isFinite(discount) || discount < 0 || discount > 100 ||
           Math.abs(discount - ((Number(row.mrp) - Number(row.sellingPrice)) / Number(row.mrp)) * 100) > 0.011 ||
          (row.buyingPrice !== '' && (Number(row.buyingPrice) < 0 ||
          Number(row.buyingPrice) > Number(row.sellingPrice))))) {
        setError('Check variant prices: buying ≤ selling ≤ MRP'); return;
      }
      if (!Number.isInteger(Number(row.stock)) || Number(row.stock) < 0) {
        setError('Stock must be a non-negative whole number'); return;
      }
      if ([row.weight, row.length, row.width, row.height].some(v => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0))) {
        setError('Weight and dimensions must be non-negative numbers'); return;
      }
    }
    const defaultIndex = variants.findIndex(v => v.key === defaultVariantKey);
    if (defaultIndex < 0) { setError('Select a default variant'); return; }
    setSaving(true);
    try {
      const payload = {
        category_id: form.category_id, name: form.name.trim(),
        slug: form.slug || generateSlug(form.name), description: form.description,
        status: productStatus, hsn_id: form.hsn_id || null,
        badge: form.badge || '', featured: form.featured,
        meta_title: form.meta_title || '', meta_description: form.meta_description || '',
        shared_attribute_value_ids: Object.values(selectedAttributes),
        variant_option_value_ids: optionIds,
        collection_ids: selectedCollectionIds, tag_ids: selectedTagIds,
        variants: selected.map(row => ({
          status: productStatus,
          attribute_value_ids: row.attributeValueIds,
          ...(row.mrp !== '' && row.sellingPrice !== '' ? {
            price: {
              mrp: Number(row.mrp), selling_price: Number(row.sellingPrice),
               discount_percentage: Number(row.discountPercentage || 0),
              buying_price: row.buyingPrice === '' ? null : Number(row.buyingPrice),
            },
          } : {}),
          stock_quantity: Number(row.stock || 0),
          images: row.images.map((img, i) => ({
            media_id: img.mediaId, sort_order: i, is_primary: i === 0,
          })),
          weight: row.weight ? Number(row.weight) : null,
          length: row.length ? Number(row.length) : null,
          width: row.width ? Number(row.width) : null,
          height: row.height ? Number(row.height) : null,
        })),
        default_variant_index: defaultIndex,
      };
      const { data: sku, error: rpcError } = await supabase.rpc(
        'create_product_with_variants_atomic', { p_data: payload }
      );
      if (rpcError) {
        if (rpcError.code === '23505' && rpcError.message.includes('products_slug_key')) {
          throw new Error('This product URL slug already exists. Choose another slug.');
        }
        throw rpcError;
      }
      setForm(prev => ({ ...prev, sku: sku as string }));
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Add Product</h2>
            <p className="text-gray-600 mt-1">Create a new product</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {metadataError && (
  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
    {metadataError}
  </div>
)}

        {success && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">Product created successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={e => e.preventDefault()} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8 space-y-8">
          
          <details open className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">01 · Basic product details</summary>
            <div className="p-5 space-y-5">
          {/* Product Name & Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Product Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleNameChange}
                placeholder="Enter product name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Slug</label>
              <input type="text" name="slug" value={form.slug} onChange={handleInputChange}
                placeholder="auto-generated-from-name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
            </div>
          </div>

          {/* Category Hierarchy & SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <CategorySelector value={form.category_id} onChange={handleCategoryChange} disabled={saving} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                SKU
              </label>
              <input
                type="text"
                value={form.sku}
                readOnly
                placeholder={form.category_id ? 'Loading preview…' : 'Select a category first'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">Auto-generated from category path</p>
            </div>
          </div>

            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">02 · Collections</summary>
            <div className="p-5">
          {/* Collections */}
          <div>
  <label className="block text-sm font-medium text-gray-900 mb-2">
    Collections
  </label>

  <p className="text-xs text-gray-500 mb-3">
    Optional. A product can belong to multiple collections.
  </p>

  {collections.length === 0 ? (
    <p className="text-sm text-gray-500">
      No active collections available.
    </p>
  ) : (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {collections.map((collection) => {
        const checked = selectedCollectionIds.includes(collection.id);

        return (
          <label
            key={collection.id}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition ${
              checked
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedCollectionIds((prev) => [
                    ...prev,
                    collection.id,
                  ]);
                } else {
                  setSelectedCollectionIds((prev) =>
                    prev.filter((id) => id !== collection.id)
                  );
                }
              }}
            />

            <span className="text-sm font-medium">
              {collection.name}
            </span>
          </label>
        );
      })}
    </div>
  )}
</div>

            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">03 · Product attributes</summary>
            <div className="p-5">
          {/* Searchable shared attributes */}
          <section className="border-t pt-6 space-y-3">
            <h3 className="text-lg font-semibold">Product Attributes</h3>
            <p className="text-xs text-gray-500">Shared product properties. Search for an attribute and select its value.</p>
            <input type="search" value={sharedSearch} onChange={e => setSharedSearch(e.target.value)}
              placeholder="Search properties (material, style, finish...)" className="w-full border rounded-lg px-3 py-2" />
            {metadataLoading ? <p className="text-sm">Loading attributes...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto pr-1">
                {attributeTypes.filter(a =>
                  (a.name.toLowerCase().includes(sharedSearch.toLowerCase()) || selectedAttributes[a.id] !== undefined) &&
                  !variantTypeIds.includes(a.id)
                ).map(a => (
                  <div key={a.id} className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-sm font-medium">{a.name}</label>
                    <select value={selectedAttributes[a.id] ?? ''} disabled={saving}
                      onChange={e => setSelectedAttributes(prev => {
                        const next = { ...prev }; if (e.target.value) next[a.id] = Number(e.target.value); else delete next[a.id]; return next;
                      })} className="w-full min-w-0 border rounded-lg px-3 py-2 text-sm">
                      <option value="">Not specified</option>
                      {a.attribute_values.map(v => <option key={v.id} value={v.id}>{v.value}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </section>

            </div>
          </details>

          <details open className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">04 · Pricing, inventory & variants ({variants.length})</summary>
            <div className="p-5">
          {true && (
            <section className="border-t border-gray-100 pt-8 space-y-5">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Pricing, Inventory & Variants</h3>
                <p className="text-sm text-gray-500">The first configuration is always V01. To create additional variants, choose attributes, assign a combination to V01, then add other combinations.</p>
              </div>
              <div className="border rounded-xl p-4 space-y-3">
                <label className="block text-sm font-medium">Add variant attribute</label>
                <input type="search" value={attributeSearch} onChange={e => setAttributeSearch(e.target.value)}
                  placeholder="Search Size, Color, Material..." className="w-full border rounded-lg px-3 py-2" />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {attributeTypes.filter(a =>
                    a.name.toLowerCase().includes(attributeSearch.toLowerCase()) &&
                    !variantTypeIds.includes(a.id) && selectedAttributes[a.id] === undefined
                  ).slice(0, 12).map(a => (
                    <button key={a.id} type="button" disabled={saving || variants.length > 1}
                      onClick={() => { setVariantTypeIds(prev => [...prev, a.id]); setVariants(prev => prev.map(v => v.key === 'base' ? {...v, attributeValueIds: []} : v)); setAttributeSearch(''); }}
                      className="block w-full text-left text-sm px-3 py-2 rounded hover:bg-gray-50 disabled:opacity-40">+ {a.name}</button>
                  ))}
                </div>
                {variants.length > 1 && <p className="text-xs text-amber-700">To change which attributes define variants, remove the existing variants first. Their entered details are not automatically discarded.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {variantTypeIds.map(typeId => {
                  const attr = attributeTypes.find(a => a.id === typeId);
                  if (!attr) return null;
                  return <div key={typeId} className="flex flex-col gap-2 border rounded-lg p-3 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{attr.name}</span>
                      <button type="button" disabled={saving || variants.length > 1}
                        onClick={() => { setVariants(prev => prev.map(v => v.key === 'base' ? {...v, attributeValueIds: []} : v)); setVariantTypeIds(prev => prev.filter(id => id !== typeId)); setDraftVariantValues(prev => { const next = {...prev}; delete next[typeId]; return next; }); }}
                        className="text-red-600 text-xs disabled:opacity-40">Remove</button>
                    </div>
                    <select value={draftVariantValues[typeId] ?? ''} disabled={saving}
                      onChange={e => setDraftVariantValues(prev => ({...prev, [typeId]: Number(e.target.value)}))}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Choose {attr.name}</option>
                      {attr.attribute_values.map(v => <option key={v.id} value={v.id}>{v.value}</option>)}
                    </select>
                  </div>;
                })}
                </div>
                {variantTypeIds.length > 0 && variants[0]?.attributeValueIds.length === 0 && <button type="button" disabled={saving} onClick={assignFirstVariant}
                  className="mr-2 px-4 py-2 rounded-lg border border-[#960018] text-[#960018] text-sm">Assign to first variant (V01)</button>}
                <button type="button" disabled={saving || variantTypeIds.length === 0 || variants[0]?.attributeValueIds.length === 0} onClick={addVariant}
                  className="px-4 py-2 rounded-lg bg-[#960018] text-white text-sm disabled:opacity-50">+ Add Variant</button>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Created Variants ({variants.length})</h4>
                {variants.length === 0 && <p className="text-sm text-gray-500">No variants added yet.</p>}
                {variants.map((v, index) => (
                  <div key={v.key} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-4 bg-gray-50">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{v.attributeValueIds.length ? v.attributeValueIds.map(valueName).join(' / ') : 'Default configuration'}</p>
                        <p className="text-xs font-mono text-gray-500">Variant SKU: {form.sku ? `${form.sku}-V${String(index + 1).padStart(2, '0')}` : 'Generated on save'} (preview)</p>
                        <p className="text-xs text-gray-500">Selling: {v.sellingPrice || '—'} · Stock: {v.stock}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs whitespace-nowrap"><input type="radio" name="defaultVariant"
                          checked={defaultVariantKey === v.key} onChange={() => setDefaultVariantKey(v.key)} /> Default</label>
                        <button type="button" onClick={() => setExpandedVariantKey(prev => prev === v.key ? null : v.key)}
                          className="text-sm border rounded-lg px-3 py-1.5">{expandedVariantKey === v.key ? 'Close' : 'Edit'}</button>
                        <button type="button" disabled={saving || v.key === 'base'} onClick={() => removeVariant(v.key)}
                          className="text-red-600 text-sm">Remove</button>
                      </div>
                    </div>
                    {expandedVariantKey === v.key && <div className="p-4 space-y-4">
                      <label className="block text-sm">Variant SKU
                        <input type="text" readOnly value={form.sku ? `${form.sku}-V${String(index + 1).padStart(2, '0')} (preview)` : 'Generated on save'}
                          className="mt-1 w-full bg-gray-100 border rounded-lg px-3 py-2 font-mono text-sm" />
                      </label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                         {([['buyingPrice','Buying Price'],['mrp','MRP'],['discountPercentage','Discount (%)'],['sellingPrice','Selling Price'],['stock','Stock'],
                           ['weight','Weight (g)'],['length','Length (cm)'],['width','Width (cm)'],['height','Height (cm)']] as const).map(([field,label]) => (
                           <label key={field} className="text-sm">{label}
                             <input type="number" min="0" max={field === 'discountPercentage' ? '100' : undefined}
                               step={field === 'stock' ? '1' : '0.01'} value={v[field]}
                               onChange={e => field === 'mrp' || field === 'discountPercentage' || field === 'sellingPrice'
                                 ? updateVariantPricing(v.key, field, e.target.value)
                                 : updateVariant(v.key, { [field]: e.target.value })}
                               className="mt-1 w-full border rounded-lg px-3 py-2" />
                           </label>
                         ))}
                       </div>
                       <p className="text-xs text-gray-500">Enter a discount to calculate selling price, or enter a selling price to calculate discount. Use 0% for no discount.</p>
                      <div>
                        <label className="block text-sm font-medium mb-2">Variant images (first is primary)</label>
                        <input type="file" accept="image/*" multiple disabled={saving || uploading}
                          onChange={e => { const files = Array.from(e.target.files || []); files.forEach(file => { void handleVariantImageUpload(v.key, file); }); e.target.value = ''; }}
                          className="text-sm" />
                        <div className="flex flex-wrap gap-3 mt-3">
                          {v.images.map((img, i) => <div key={img.mediaId} className="relative">
                            <img src={img.url} alt={`Variant image ${i + 1}`} className="w-20 h-20 rounded-lg object-cover" />
                            <button type="button" disabled={saving} onClick={() => updateVariant(v.key, {images: v.images.filter(x => x.mediaId !== img.mediaId)})}
                              className="absolute top-0 right-0 bg-red-600 text-white rounded-full px-1">×</button>
                          </div>)}
                        </div>
                      </div>
                    </div>}
                  </div>
                ))}
              </div>
            </section>
          )}
            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">05 · Product tags</summary>
            <div className="p-5 space-y-5">
 {/* Product Tags */}
<div className="border-t pt-6">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Product Tags
  </h3>

  <p className="text-xs text-gray-500 mb-3">
    Optional. Search and select multiple tags.
  </p>

  <div className="flex flex-wrap gap-2 mb-3">
    {tags
      .filter((tag) => selectedTagIds.includes(tag.id))
      .map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-2 bg-blue-50
                     text-blue-700 px-3 py-1 rounded-full text-sm"
        >
          {tag.name}

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setSelectedTagIds((prev) =>
                prev.filter((id) => id !== tag.id)
              )
            }
            aria-label={`Remove ${tag.name}`}
          >
            ×
          </button>
        </span>
      ))}
  </div>

  <div className="flex gap-2">
    <input
      type="text"
      value={tagSearch}
      onChange={(e) => {
        setTagSearch(e.target.value);
        setTagAction(null);
      }}
      placeholder="Search tags or type a new tag name..."
      disabled={saving || metadataLoading || tagProcessing}
      className="flex-1 px-4 py-2 border rounded-lg"
    />
    {tagSearch.trim() !== '' && filteredTagOptions.length === 0 && !tagAction && (
      <button
        type="button"
        onClick={handleCreateTagFromSearch}
        disabled={saving || tagProcessing}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition text-sm whitespace-nowrap disabled:opacity-50"
      >
        {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {tagProcessing ? 'Checking...' : `Create "${tagSearch.trim()}"`}
      </button>
    )}
  </div>

  {tagSearch.trim() !== '' && filteredTagOptions.length > 0 && !tagAction && (
    <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
      {filteredTagOptions
        .slice(0, 20)
        .map((tag) => (
          <button
            key={tag.id}
            type="button"
            disabled={saving}
            onClick={() => {
              setSelectedTagIds((prev) => [...prev, tag.id]);
              setTagSearch('');
            }}
            className="block w-full text-left px-4 py-2
                       hover:bg-blue-50 text-sm"
          >
            {tag.name}
          </button>
        ))}
      {filteredTagOptions.length === 0 && tagSearch.trim() && !tagAction && (
        <button
          type="button"
          onClick={handleCreateTagFromSearch}
          disabled={saving || tagProcessing}
          className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-blue-600 font-medium"
        >
          {tagProcessing ? 'Checking...' : `+ Create new tag "${tagSearch.trim()}"`}
        </button>
      )}
    </div>
  )}

  {tagSearch.trim() !== '' && filteredTagOptions.length === 0 && !tagAction && !tagProcessing && (
    <p className="mt-2 text-xs text-gray-500">
      No matching tags found. Click the button to create a new one.
    </p>
  )}

  {/* Tag action confirmation dialogs */}
  {tagAction?.mode === 'confirm-reactivate' && (
    <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-amber-800 text-sm mb-3">
          An inactive tag named &quot;{tagAction.tag.name}&quot; already exists.
          Reactivate it and select it for this product? Its original ID and
          product associations will be preserved.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => doReactivateTag(tagAction.tag)}
            disabled={tagProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Reactivate &amp; Select
          </button>
          <button
            type="button"
            onClick={() => setTagAction(null)}
            disabled={tagProcessing}
            className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}

  {tagAction?.mode === 'confirm-similar-active' && (
    <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-amber-800 text-sm mb-3">
          A similar active tag already exists: &quot;{tagAction.tag.name}&quot;.
          Consider using the existing tag instead.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => selectTag(tagAction.tag)}
            disabled={tagProcessing}
            className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            Use Existing
          </button>
          <button
            type="button"
            onClick={() => doCreateTag(tagAction.name, tagAction.slug)}
            disabled={tagProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Anyway
          </button>
          <button
            type="button"
            onClick={() => setTagAction(null)}
            disabled={tagProcessing}
            className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}

  {tagAction?.mode === 'confirm-similar-inactive' && (
    <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-amber-800 text-sm mb-3">
          A similar inactive tag already exists: &quot;{tagAction.tag.name}&quot;.
          You can reactivate the existing tag, create a new one anyway, or cancel.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => doReactivateTag(tagAction.tag)}
            disabled={tagProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Reactivate Existing
          </button>
          <button
            type="button"
            onClick={() => doCreateTag(tagAction.name, tagAction.slug)}
            disabled={tagProcessing}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create New
          </button>
          <button
            type="button"
            onClick={() => setTagAction(null)}
            disabled={tagProcessing}
            className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )}
</div>
            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">06 · Tax, description & merchandising</summary>
            <div className="p-5 space-y-5">
          {/* HSN Code & GST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-900 mb-2">HSN Code *</label>
              <input
                type="text"
                value={hsnSearch || form.hsn_code}
                onChange={(e) => handleHsnSearchChange(e.target.value)}
                onFocus={() => setHsnDropdownOpen(true)}
                onBlur={() => setTimeout(() => setHsnDropdownOpen(false), 200)}
                placeholder="Search HSN code or description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              />
              <Search className="absolute right-3 top-9 w-4 h-4 text-gray-400" />
              {hsnDropdownOpen && filteredHsn.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredHsn.map((hsn) => (
                    <button
                      key={hsn.id}
                      type="button"
                      onMouseDown={() => handleHsnSelect(hsn)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-sm">{hsn.hsn_code}</span>
                        <span className="text-xs text-gray-500">GST {hsn.gst_percentage}%</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{hsn.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">GST % (Read Only)</label>
              <input
                type="text"
                value={form.gst_percentage ? `${form.gst_percentage}%` : ''}
                readOnly
                placeholder="Auto-filled from HSN"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
            </div>
          </div>


          {/* Badge */}
          <div>
  <label className="block text-sm font-medium text-gray-900 mb-2">
    Badge
  </label>
  <input
    type="text"
    name="badge"
    value={form.badge}
    onChange={handleInputChange}
    placeholder="e.g., New, Sale, Featured"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    disabled={saving}
  />
</div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description *</label>
            <textarea name="description" value={form.description} onChange={handleInputChange}
              placeholder="Enter product description" rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" disabled={saving} />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" checked={form.featured} onChange={handleInputChange}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" disabled={saving} />
              <span className="text-sm font-medium text-gray-900">Featured</span>
            </label>

          </div>

            </div>
          </details>

          {/* SEO */}
          <details className="border rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-900 hover:bg-gray-50">
              SEO & Metadata
            </summary>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Meta Title</label>
                <input type="text" name="meta_title" value={form.meta_title} onChange={handleInputChange}
                  placeholder="SEO title" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Meta Description</label>
                <textarea name="meta_description" value={form.meta_description} onChange={handleInputChange}
                  placeholder="SEO description" rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" disabled={saving} />
              </div>
            </div>
          </details>

          <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>Unsaved changes are automatically stored in this browser. Uploaded images remain in Supabase storage.</span>
            <button type="button" onClick={discardLocalDraft} disabled={saving || uploading}
              className="shrink-0 text-red-700 hover:underline">Discard local draft</button>
          </div>
          {/* Page actions */}
          <div className="flex flex-wrap gap-3 pt-6 border-t justify-end">
            <button type="button" onClick={() => navigate('/admin')} disabled={saving}
              className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void handleSubmit('draft')}
              disabled={saving || uploading || metadataLoading || !!metadataError}
              className="px-5 py-2.5 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
  type="button"
  onClick={() => void handleSubmit('published')}
  disabled={saving || uploading || metadataLoading || !!metadataError}
  className="px-6 py-2.5 bg-[#960018] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
>
  {saving ? 'Publishing...' : 'Publish'}
</button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
