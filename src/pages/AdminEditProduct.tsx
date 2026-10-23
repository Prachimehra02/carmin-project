import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, AlertCircle, CheckCircle, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { CategorySelector } from '../components/CategorySelector';
import { supabase } from '../lib/supabase';
import { HsnMaster } from '../types/product';
import {
  type AttributeTypeWithValues,
  type AttributeValue,
  fetchAllAttributeTypes,
} from '../services/attributeService';
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
  
  buying_price: string;
  price: string;
  discount_percentage: string;
  sale_price: string;
  description: string;
  images: string[];
  badge?: string;
  stock_quantity: string;
  featured: boolean;
  is_active: boolean;
  meta_title: string;
  meta_description: string;
  weight: string;
  dimensions_length: string;
  dimensions_width: string;
  dimensions_height: string;
  hsn_id: string;
  hsn_code: string;
  gst_percentage: string;
}

interface VariantImage { mediaId: string; url: string }
interface EditVariant {
  id: string; sku: string; status: string; isDefault: boolean;
  attributeValueIds: number[];
  buyingPrice: string; mrp: string; discountPercentage: string;
  sellingPrice: string; stock: string; images: VariantImage[];
  weight: string; length: string; width: string; height: string;
}
interface NewVariantDraft {
  attributeValueIds: Record<number, number>;
  buyingPrice: string; mrp: string; discountPercentage: string;
  sellingPrice: string; stock: string; images: VariantImage[];
  weight: string; length: string; width: string; height: string;
}
const blankNewVariant = (): NewVariantDraft => ({
  attributeValueIds: {}, buyingPrice: '', mrp: '', discountPercentage: '0',
  sellingPrice: '', stock: '0', images: [], weight: '', length: '', width: '', height: '',
});

const editPricing = (v: EditVariant, field: 'mrp' | 'discountPercentage' | 'sellingPrice' | 'buyingPrice', value: string): EditVariant => {
  const next = { ...v, [field]: value };
  const mrp = Number(next.mrp);
  if (field === 'mrp' || field === 'discountPercentage') {
    if (next.mrp !== '' && mrp > 0) {
      const discount = field === 'mrp' && next.discountPercentage === '' ? 0 : Number(next.discountPercentage || 0);
      if (field === 'mrp' && next.discountPercentage === '') next.discountPercentage = '0';
      next.sellingPrice = (mrp * (1 - discount / 100)).toFixed(2);
    } else next.sellingPrice = '';
  } else if (field === 'sellingPrice') {
    next.discountPercentage = value !== '' && mrp > 0
      ? (Math.round(((mrp - Number(value)) / mrp) * 10000) / 100).toString() : '';
  }
  return next;
};

interface Collection {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

type TagAction =
  | { mode: 'confirm-reactivate'; tag: Tag }
  | { mode: 'confirm-similar-active'; name: string; slug: string; tag: Tag }
  | { mode: 'confirm-similar-inactive'; name: string; slug: string; tag: Tag }
  | null;

const CATEGORIES = [
  'pots-planters',
  'vases',
  'sculptures',
  'artifacts',
  'decor-accessories',
  'wall-decor',
  'mirrors',
  'new-arrival',
];

export default function AdminEditProduct() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>({
    name: '',
    slug: '',
    category_id: null,
    sku: '',
    
    buying_price: '',
    price: '',
    discount_percentage: '',
    sale_price: '',
    description: '',
    images: [],
    badge: '',
    stock_quantity: '0',
    featured: false,
    is_active: true,
    meta_title: '',
    meta_description: '',
    weight: '',
    dimensions_length: '',
    dimensions_width: '',
    dimensions_height: '',
    hsn_id: '',
    hsn_code: '',
    gst_percentage: '',
  });
  const [variants, setVariants] = useState<EditVariant[]>([]);
  const originalVariants = useRef<EditVariant[]>([]);
  const [variantLoading, setVariantLoading] = useState(true);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState(false);
  const [variantActionId, setVariantActionId] = useState<string | null>(null);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariant, setNewVariant] = useState<NewVariantDraft>(blankNewVariant);
  const [copySourceVariantId, setCopySourceVariantId] = useState('');
  const [copyStock, setCopyStock] = useState(false);
  const [variantOptionIds, setVariantOptionIds] = useState<number[]>([]);
  const [variantAttributeSearch, setVariantAttributeSearch] = useState('');
  const [sharedAttributeSearch, setSharedAttributeSearch] = useState('');
  const [migrationTypeIds, setMigrationTypeIds] = useState<number[]>([]);
  const [migrationValues, setMigrationValues] = useState<Record<string, Record<number, number>>>({});
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [variantOptionsLoading, setVariantOptionsLoading] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);

  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);
  const [productStatus, setProductStatus] = useState<'draft' | 'published' | 'inactive'>('draft');
  const [submitAction, setSubmitAction] = useState<'save_draft' | 'publish' | 'save_changes' | 'set_inactive' | 'set_active'>('save_changes');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [variantActionSuccess, setVariantActionSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hsnList, setHsnList] = useState<HsnMaster[]>([]);
  const [hsnSearch, setHsnSearch] = useState('');
  const [hsnDropdownOpen, setHsnDropdownOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);

  const [attributeTypes, setAttributeTypes] = useState<AttributeTypeWithValues[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<number, number>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagAction, setTagAction] = useState<TagAction>(null);
  const [tagProcessing, setTagProcessing] = useState(false);

  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const resetSelections = useCallback(() => {
    setSelectedAttributes({});
    setSelectedTagIds([]);
    setSelectedCollectionIds([]);
  }, []);

  useEffect(() => {
    fetchHsnList();
    fetchCollections();
    fetchProductMetadata();
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    resetSelections();
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    void (async () => { await fetchProduct(id); await fetchVariants(id); })();
    void fetchVariantOptions(id);
    fetchProductCollections(id);
    fetchProductAssignments(id);
  }, [id, resetSelections]);

  const fetchHsnList = async () => {
    const { data, error } = await supabase
      .from('hsn_master')
      .select('*')
      .eq('is_active', true)
      .order('hsn_code');
    if (!error && data) setHsnList(data);
  };

  const fetchCollections = async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('id, name, slug, active')
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
        fetchAllAttributeTypes(),
        fetchAllTags(),
      ]);
      setAttributeTypes(attributesData);
      setTags(tagsData);
    } catch (err) {
      setMetadataError(
        err instanceof Error ? err.message : 'Failed to load attributes and tags'
      );
    } finally {
      setMetadataLoading(false);
    }
  };

  const fetchProductCollections = async (productId: string) => {
    const { data, error } = await supabase
      .from('product_collections')
      .select('collection_id')
      .eq('product_id', productId);
    if (error) {
      console.error('Failed to load product collections:', error);
      return;
    }
    setSelectedCollectionIds((data || []).map((row) => Number(row.collection_id)));
  };

  const fetchProductAssignments = async (productId: string) => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const [attrRes, tagRes] = await Promise.all([
        supabase
          .from('product_attribute_values')
          .select('attribute_value_id, attribute_values (attribute_type_id, value, active)')
          .eq('product_id', productId),
        supabase
          .from('product_tags')
          .select('tag_id')
          .eq('product_id', productId),
      ]);

      if (attrRes.error) throw attrRes.error;
      if (tagRes.error) throw tagRes.error;

      const attrMap: Record<number, number> = {};

for (const row of attrRes.data || []) {
  const related = row.attribute_values;

  const av = Array.isArray(related)
    ? related[0]
    : related;

  if (av?.attribute_type_id != null && row.attribute_value_id != null) {
    attrMap[Number(av.attribute_type_id)] =
      Number(row.attribute_value_id);
  }
}

const tagIds = (tagRes.data || []).map(
  (row) => Number(row.tag_id)
);

console.log('Loaded product attributes:', attrMap);
console.log('Loaded product tags:', tagIds);

setSelectedAttributes(attrMap);
setSelectedTagIds(tagIds);
    } catch (err) {
      setAssignmentsError(
        err instanceof Error ? err.message : 'Failed to load existing attribute/tag selections'
      );
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchProduct = async (productId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*, hsn_master!products_hsn_id_fkey (*)')
        .eq('id', productId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) { setError('Product not found'); return; }

      const product = data as any;
      setProductStatus((product.status || (product.is_active ? 'published' : 'inactive')) as 'draft' | 'published' | 'inactive');

      setForm({
        name: product.name,
        slug: product.slug || '',
        category_id: (product as any).category_id ?? null,
        sku: product.sku || '',
        
        buying_price: '',
        price: '',
        discount_percentage: '0',
        sale_price: '',
        description: product.description || '',
        images: [],
        badge: product.badge || '',
        stock_quantity: '0',
        featured: product.featured ?? false,
        is_active: product.is_active ?? true,
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
        weight: '',
        dimensions_length: '',
        dimensions_width: '',
        dimensions_height: '',
        hsn_id: (product as any).hsn_id || '',
        hsn_code: (product as any).hsn_code || (product as any).hsn_master?.hsn_code || '',
        gst_percentage: (product as any).gst_percentage != null ? String((product as any).gst_percentage) : ((product as any).hsn_master?.gst_percentage != null ? String((product as any).hsn_master.gst_percentage) : ''),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch product');
    } finally {
      setLoading(false);
    }
  };

  const fetchVariantOptions = async (productId: string) => {
    setVariantOptionsLoading(true);
    try {
      const { data, error: optionError } = await supabase
        .from('product_variant_options').select('attribute_value_id')
        .eq('product_id', productId);
      if (optionError) throw optionError;
      setVariantOptionIds((data || []).map(row => Number(row.attribute_value_id)));
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : 'Failed to load variant options');
    } finally {
      setVariantOptionsLoading(false);
    }
  };

  const fetchVariants = async (productId: string) => {
    setVariantLoading(true); setVariantError(null);
    try {
      const { data: rows, error: err } = await supabase.from('product_variants')
        .select('id, sku, status, weight, length, width, height, combination_key')
        .eq('product_id', productId).order('sku');
      if (err) throw err;
      const ids = (rows || []).map(v => v.id);
      if (!ids.length) { setVariants([]); setVariantProduct(false); return; }
      const [p, i, m, a, prod] = await Promise.all([
        supabase.from('variant_prices').select('variant_id,buying_price,mrp,discount_percentage,selling_price')
          .in('variant_id', ids).eq('currency_code','INR').is('effective_to',null),
        supabase.from('variant_inventory').select('variant_id,stock_quantity').in('variant_id',ids),
        supabase.from('variant_media').select('variant_id,media_id,sort_order,is_primary,media_assets(public_url)')
          .in('variant_id',ids).order('sort_order'),
        supabase.from('variant_attribute_values').select('variant_id,attribute_value_id').in('variant_id',ids),
        supabase.from('products').select('default_variant_id').eq('id',productId).single(),
      ]);
      for (const r of [p,i,m,a,prod]) if (r.error) throw r.error;
      const loaded: EditVariant[] = (rows || []).map(v => {
        const price = (p.data || []).find(x => x.variant_id === v.id);
        const stock = (i.data || []).find(x => x.variant_id === v.id);
        const images = (m.data || []).filter(x => x.variant_id === v.id).map(x => {
          const asset = Array.isArray(x.media_assets) ? x.media_assets[0] : x.media_assets;
          return { mediaId: String(x.media_id), url: String(asset?.public_url || '') };
        }).filter(x => x.url);
        return {
          id: v.id, sku: v.sku, status: v.status,
          isDefault: prod.data?.default_variant_id === v.id,
          attributeValueIds: (a.data || []).filter(x => x.variant_id === v.id).map(x => Number(x.attribute_value_id)),
          buyingPrice: price?.buying_price == null ? '' : String(price.buying_price),
          mrp: price?.mrp == null ? '' : String(price.mrp),
          discountPercentage: price?.discount_percentage == null ? '0' : String(price.discount_percentage),
          sellingPrice: price?.selling_price == null ? '' : String(price.selling_price),
          stock: String(stock?.stock_quantity ?? 0), images,
          weight: v.weight == null ? '' : String(v.weight),
          length: v.length == null ? '' : String(v.length),
          width: v.width == null ? '' : String(v.width),
          height: v.height == null ? '' : String(v.height),
        };
      });
      originalVariants.current = loaded;
      setVariants(loaded);
      setVariantProduct(loaded.some(v => v.attributeValueIds.length > 0));
      setExpandedVariant(loaded[0]?.id || null);
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : 'Failed to load variants');
    } finally { setVariantLoading(false); }
  };

  // Publication/default actions are deliberately separate from the product Save flow.
  // Prevent an action from reloading variants and discarding unsaved variant edits.
  const hasUnsavedVariantEdits = variants.some(v => {
    const original = originalVariants.current.find(x => x.id === v.id);
    return !original || JSON.stringify(v) !== JSON.stringify(original);
  });

  const manageVariantState = async (variant: EditVariant, action: 'activate' | 'deactivate' | 'set_default') => {
    if (!id || saving || variantActionId || variantLoading || hasUnsavedVariantEdits) {
      setError(hasUnsavedVariantEdits ? 'Save your variant edits before changing publication status or default variant.' : 'Please wait for the current operation to finish.');
      return;
    }
    if (productStatus !== 'published') {
      setError('Variant activation and default changes are available only for published, active products.');
      return;
    }
    const message = action === 'set_default'
      ? `Set ${variant.sku} as the default variant?`
      : action === 'deactivate'
        ? `Deactivate ${variant.sku}? Customers will no longer be able to purchase this variant.`
        : `Activate ${variant.sku}?`;
    if (!window.confirm(message)) return;
    setVariantActionId(variant.id);
    setError(null);
    setVariantActionSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc('manage_product_variant_state', {
        p_product_id: id,
        p_variant_id: variant.id,
        p_action: action,
        p_new_default_variant_id: null,
      });
      if (rpcError) throw rpcError;
      await fetchVariants(id);
      setVariantActionSuccess(`${variant.sku}: ${action === 'set_default' ? 'default updated' : action === 'activate' ? 'activated' : 'deactivated'} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variant action failed');
    } finally {
      setVariantActionId(null);
    }
  };

  // Read both sources: the converted V01 can be visible before product options refresh.
  const configuredVariantValueIds = [...new Set([...variantOptionIds, ...variants.flatMap(v => v.attributeValueIds)])];
  const existingVariantTypeIds = [...new Set(attributeTypes.filter(type => type.attribute_values.some(value => configuredVariantValueIds.includes(value.id))).map(type => type.id))];
  const isSingleUnconfiguredVariant = variants.length === 1 && variants[0].attributeValueIds.length === 0 && existingVariantTypeIds.length === 0;
  const availableMigrationTypes = attributeTypes.filter(type => type.active && !selectedAttributes[type.id] && !existingVariantTypeIds.includes(type.id));

  const variableAttributeTypes = attributeTypes.map(type => ({
    ...type,
    allowedValues: type.attribute_values.filter(value => value.active),
  })).filter(type => type.active && type.attribute_values.some(value => configuredVariantValueIds.includes(value.id)));

  const updateNewVariantPricing = (field: 'mrp' | 'discountPercentage' | 'sellingPrice' | 'buyingPrice', value: string) => {
    setNewVariant(prev => {
      const updated = editPricing({ ...prev, id: '', sku: '', status: 'draft', isDefault: false,
        attributeValueIds: [], stock: prev.stock }, field, value);
      return { ...prev, [field]: updated[field],
        discountPercentage: updated.discountPercentage, sellingPrice: updated.sellingPrice };
    });
  };

  const uploadNewVariantImage = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Select an image up to 10 MB'); return;
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
        throw assetError || new Error('Could not register media');
      }
      setNewVariant(prev => ({ ...prev, images: [...prev.images, { mediaId: String(asset.id), url: urlData.publicUrl }] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally { setUploading(false); }
  };

  // Structural changes are deliberately separate from ordinary edits. The database
  // must implement migrate_product_variant_attributes_atomic transactionally before use.
  const migrateVariantStructure = async () => {
    if (!id || !isSingleUnconfiguredVariant || !migrationTypeIds.length) return;
    if (hasUnsavedVariantEdits || saving || uploading || addingVariant || migrationLoading) {
      setError('Save outstanding changes and finish uploads before converting the variant.'); return;
    }
    const current = variants[0];
    const chosen = migrationTypeIds.map(typeId => migrationValues[current.id]?.[typeId]);
    if (chosen.some(x => !x)) { setError('Choose one value for every selected attribute for the existing variant.'); return; }
    if (migrationTypeIds.some(typeId => selectedAttributes[typeId] !== undefined)) {
      setError('Remove shared product attributes and save before using them for variants.'); return;
    }
    if (!window.confirm(`Convert ${current.sku} to an attribute-based variant? Its ID, SKU, prices, stock and images will be preserved.`)) return;
    setMigrationLoading(true); setError(null);
    try {
      const { error: migrationError } = await supabase.rpc('convert_simple_product_variant_atomic', {
        p_data: { product_id: id, variant_assignments: [{variant_id: current.id, attribute_value_ids: chosen}] },
      });
      if (migrationError) throw migrationError;
      // Verify the committed database state instead of assuming the RPC worked.
      const { data: confirmed, error: confirmationError } = await supabase
        .from('variant_attribute_values')
        .select('attribute_value_id')
        .eq('variant_id', current.id);
      if (confirmationError) throw confirmationError;
      const confirmedIds = new Set((confirmed ?? []).map(row => Number(row.attribute_value_id)));
      if (!chosen.every(value => confirmedIds.has(Number(value)))) {
        throw new Error('Conversion could not be verified. Reload the product before trying again.');
      }
      // Update V01 immediately so conversion controls disappear and Add Variant appears.
      setVariants(prev => prev.map(v => v.id === current.id
        ? { ...v, attributeValueIds: [...chosen].map(Number) } : v));
      setVariantOptionIds(prev => [...new Set([...prev, ...chosen.map(Number)])]);
      setVariantProduct(true);
      setMigrationTypeIds([]); setMigrationValues({});
      await Promise.all([fetchVariants(id), fetchVariantOptions(id)]);
      setVariantActionSuccess('Product converted successfully. Use + Add Variant to create another combination.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variant attribute conversion failed');
    } finally { setMigrationLoading(false); }
  };

  // Copies editable details only. Never copy the source ID, SKU, status,
  // default flag or attribute combination into a new variant.
  const copyVariantDetails = () => {
    const source = variants.find(v => v.id === copySourceVariantId);
    if (!source) { setError('Select a source variant first.'); return; }
    setNewVariant(previous => ({
      ...previous,
      buyingPrice: source.buyingPrice,
      mrp: source.mrp,
      discountPercentage: source.discountPercentage,
      sellingPrice: source.sellingPrice,
      images: source.images.map(img => ({ ...img })),
      weight: source.weight,
      length: source.length,
      width: source.width,
      height: source.height,
      stock: copyStock ? source.stock : previous.stock,
    }));
    setError(null);
    setVariantActionSuccess(`Copied details from ${source.sku}. Review them before creating the new variant.`);
  };

  const addVariant = async () => {
    if (!id || (productStatus !== 'draft' && !(productStatus === 'published' && form.is_active))) {
      setError('Variants can be added to draft or active, published products.'); return;
    }
    if (saving || addingVariant || variantActionId || variantLoading || variantOptionsLoading || uploading || hasUnsavedVariantEdits) {
      setError('Finish uploads and save existing variant edits before adding a variant.'); return;
    }
    const ids = variableAttributeTypes.map(type => newVariant.attributeValueIds[type.id]);
    if (ids.some(value => !value) || ids.length === 0) {
      setError('Select one value for every variant attribute.'); return;
    }
    const combination = [...ids].sort((a,b) => a-b).join(',');
    if (variants.some(v => [...v.attributeValueIds].sort((a,b) => a-b).join(',') === combination)) {
      setError('This variant combination already exists, including inactive variants.'); return;
    }
    const isDraftVariant = productStatus === 'draft';
    const hasPrice = newVariant.mrp !== '' || newVariant.sellingPrice !== '' || newVariant.buyingPrice !== '';
    const mrp = Number(newVariant.mrp), selling = Number(newVariant.sellingPrice);
    const buying = newVariant.buyingPrice === '' ? null : Number(newVariant.buyingPrice);
    const discount = Number(newVariant.discountPercentage);
    const stock = Number(newVariant.stock);
    if ((!isDraftVariant || hasPrice) && (!newVariant.mrp || newVariant.sellingPrice === '' || !Number.isFinite(mrp) || mrp <= 0 ||
        !Number.isFinite(selling) || selling < 0 || selling > mrp ||
        (buying !== null && (!Number.isFinite(buying) || buying < 0 || buying > selling)) ||
        !Number.isFinite(discount) || discount < 0 || discount > 100 ||
        Math.abs(discount - Math.round((mrp-selling)*10000/mrp)/100) > 0.011)) {
      setError('Enter valid MRP, selling price, buying price and discount.'); return;
    }
    if (!Number.isInteger(stock) || stock < 0) { setError('Stock must be a nonnegative integer.'); return; }
    if (!isDraftVariant && !newVariant.images.length) { setError('Upload at least one variant image.'); return; }
    for (const field of ['weight','length','width','height'] as const) {
      const value = newVariant[field];
      if (value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 ||
          (field !== 'weight' && Number(value) === 0))) {
        setError(`Enter a valid ${field}.`); return;
      }
    }
    setAddingVariant(true); setError(null); setVariantActionSuccess(null);
    try {
      const optionalNumber = (value: string) => value === '' ? null : Number(value);
      const { data, error: rpcError } = await supabase.rpc('add_product_variant_with_options_atomic', {
        p_data: {
          product_id: id, status: isDraftVariant ? 'draft' : 'published', attribute_value_ids: ids,
          ...(hasPrice ? { price: { mrp, selling_price: selling, buying_price: buying,
            discount_percentage: Math.round((mrp-selling)*10000/mrp)/100 } } : {}),
          stock_quantity: stock,
          images: newVariant.images.map((img, index) => ({
            media_id: img.mediaId, sort_order: index, is_primary: index === 0,
          })),
          weight: optionalNumber(newVariant.weight), length: optionalNumber(newVariant.length),
          width: optionalNumber(newVariant.width), height: optionalNumber(newVariant.height),
        },
      });
      if (rpcError) throw rpcError;
      setShowAddVariant(false); setNewVariant(blankNewVariant());
      await Promise.all([fetchVariants(id), fetchVariantOptions(id)]);
      setVariantActionSuccess(`New variant created successfully (ID: ${String(data)}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create variant');
    } finally { setAddingVariant(false); }
  };

  const changeVariant = (variantId: string, patch: Partial<EditVariant>) =>
    setVariants(prev => prev.map(v => v.id === variantId ? {...v,...patch} : v));

  const uploadVariantImage = async (variantId: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Select an image up to 10 MB'); return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `product-images/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path,file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('products').getPublicUrl(path);
      const { data: asset, error: assetError } = await supabase.from('media_assets').insert({
        file_name:file.name,storage_bucket:'products',storage_path:path,
        public_url:urlData.publicUrl,file_size:file.size,mime_type:file.type,
      }).select('id').single();
      if (assetError || !asset) {
        await supabase.storage.from('products').remove([path]);
        throw assetError || new Error('Could not register media');
      }
      setVariants(prev => prev.map(v => v.id === variantId ? {
        ...v, images:[...v.images,{mediaId:asset.id,url:urlData.publicUrl}],
      } : v));
    } catch (err) { setError(err instanceof Error ? err.message : 'Image upload failed'); }
    finally { setUploading(false); }
  };

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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

  const handleCategoryChange = (categoryId: number | null) => {
    setForm(prev => ({ ...prev, category_id: categoryId }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      setForm(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
      return;
    }

    setForm(prev => {
      const updated = {
        ...prev,
        [name]: value,
      };

      if (name === "price" || name === "discount_percentage" || name === "sale_price") {
        const price = Number(updated.price);
        const priceFilled = updated.price !== "" && !isNaN(price) && price > 0;

        if (priceFilled) {
          if (name === "sale_price") {
            const salePrice = Number(updated.sale_price);
            if (updated.sale_price !== "" && !isNaN(salePrice)) {
              const calculatedDiscount = ((price - salePrice) / price) * 100;
              updated.discount_percentage = (Math.round(calculatedDiscount * 100) / 100).toString();
            }
          } else {
            const discountStr = name === "discount_percentage" ? value : updated.discount_percentage;
            const discount = Number(discountStr);
            if (discountStr !== "" && !isNaN(discount) && discount > 0) {
              updated.sale_price = (price - (price * discount) / 100).toFixed(2);
            } else {
              updated.sale_price = price.toFixed(2);
            }
          }
        }
      }

      if (name === "name") {
        updated.slug = generateSlug(value);
        if (!updated.meta_title) {
          updated.meta_title = value;
        }
      }

      return updated;
    });
  };

  // ─── Tag creation / reactivation helpers (mirrors AdminAddProduct) ───

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
        setSelectedTagIds((prev) => [...prev, existing.id]);
        setTagSearch('');
        return;
      }
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

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variantActionId || migrationLoading) { setError('Wait for the variant action to finish.'); return; }
    if (uploading) { setError('Wait for image uploads to finish.'); return; }
    if (addingVariant) { setError('Wait for the new variant to finish saving.'); return; }
    setError(null);
    const action = productStatus === 'draft' ? submitAction : (form.is_active === (productStatus === 'published') ? 'save_changes' : form.is_active ? 'set_active' : 'set_inactive');
    const activating = action === 'publish' || action === 'set_active';
    if (action === 'save_draft' && productStatus !== 'draft') {
      setError('Previously published products cannot return to draft'); return;
    }
    if (action === 'publish' && productStatus !== 'draft') {
      setError('Only draft products can be published'); return;
    }
    if (action === 'set_active' && productStatus !== 'inactive') {
      setError('Only inactive products can be reactivated'); return;
    }
    if (!allMetadataReady) { setError('Wait for product attributes and tags to finish loading.'); return; }
    if (existingVariantTypeIds.some(typeId => selectedAttributes[typeId] !== undefined)) { setError('An attribute cannot be both shared and used for variants.'); return; }
    if (!form.name.trim()) { setError('Product name is required'); return; }
    if (activating) {
  if (!form.category_id) {
    setError('Category is required to publish');
    return;
  }

  if (!form.description.trim()) {
    setError('Description is required to publish');
    return;
  }

  if (!form.hsn_id) {
    setError('HSN code is required to publish');
    return;
  }

  const publishableVariants = variants.filter(
    v => v.status !== 'inactive'
  );

  if (publishableVariants.length === 0) {
    setError('At least one active variant is required');
    return;
  }

  const defaultVariant = variants.find(v => v.isDefault);

  if (!defaultVariant || defaultVariant.status === 'inactive') {
    setError('Select an active default variant');
    return;
  }

  for (const v of publishableVariants) {
    const mrp = Number(v.mrp);
    const selling = Number(v.sellingPrice);
    const stock = Number(v.stock);

    if (
      v.mrp === '' ||
      v.sellingPrice === '' ||
      !Number.isFinite(mrp) ||
      !Number.isFinite(selling) ||
      mrp <= 0 ||
      selling < 0 ||
      selling > mrp
    ) {
      setError(`Enter valid pricing for variant ${v.sku}`);
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError(`Enter valid stock for variant ${v.sku}`);
      return;
    }

    if (v.images.length === 0) {
      setError(`Upload at least one image for variant ${v.sku}`);
      return;
    }
  }
}
    if ((action === 'save_changes' && productStatus === 'published') || (action === 'set_inactive' && productStatus === 'published')) {
      // Published products must remain complete after an edit.
      if (!form.hsn_id || !form.description.trim() || !form.category_id) {
        setError('Active products require category, HSN and description'); return;
      }
      const currentDefault = variants.find(v => v.isDefault) || variants[0];
      if (!currentDefault || !currentDefault.mrp || Number(currentDefault.mrp) <= 0 || currentDefault.sellingPrice === '' || Number(currentDefault.sellingPrice) < 0 || Number(currentDefault.sellingPrice) > Number(currentDefault.mrp) || currentDefault.images.length === 0) {
        setError('Published products must retain valid pricing and at least one image'); return;
      }
    }

    if (variantLoading || variantError) { setError(variantError || 'Variants still loading'); return; }
    for (const v of variants) {
      if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) {
        setError(`Invalid stock for ${v.sku}`); return;
      }
      if (v.mrp !== '' || v.sellingPrice !== '') {
        const mrp = Number(v.mrp), selling = Number(v.sellingPrice);
        const discount = Number(v.discountPercentage || '0');
        if (!v.mrp || v.sellingPrice === '' || !Number.isFinite(mrp) || mrp <= 0 ||
          !Number.isFinite(selling) || selling < 0 || selling > mrp ||
          !Number.isFinite(discount) || discount < 0 || discount > 100 ||
          Math.abs(discount - Math.round((mrp-selling)*10000/mrp)/100) > 0.011 ||
          (v.buyingPrice !== '' && (Number(v.buyingPrice) < 0 || Number(v.buyingPrice) > selling))) {
          setError(`Invalid pricing for ${v.sku}`); return;
        }
      }
      if (['weight','length','width','height'].some(field => {
        const value = v[field as 'weight'|'length'|'width'|'height'];
        return value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0);
      })) { setError(`Invalid dimensions for ${v.sku}`); return; }
    }
    try {
      setSaving(true);
      // Prepare changed variant edits. The single RPC below commits all changes atomically.
      const variantEdits: Array<{ id: string; data: Record<string, unknown> }> = [];
      for (const v of variants) {
        const old = originalVariants.current.find(x => x.id === v.id);
        if (old && JSON.stringify(v) === JSON.stringify(old)) continue;
        const priceChanged = !old || ['mrp','sellingPrice','buyingPrice','discountPercentage'].some(
          k => v[k as 'mrp'|'sellingPrice'|'buyingPrice'|'discountPercentage'] !== old[k as 'mrp'|'sellingPrice'|'buyingPrice'|'discountPercentage']
        );
        const payload = {
          ...(priceChanged && v.mrp !== '' && v.sellingPrice !== '' ? { price: {
            mrp: Number(v.mrp), selling_price: Number(v.sellingPrice),
            discount_percentage: Number(v.discountPercentage || 0),
            buying_price: v.buyingPrice === '' ? null : Number(v.buyingPrice),
          }} : {}),
          stock_quantity: Number(v.stock),
          images: v.images.map((img, i) => ({ media_id: img.mediaId, sort_order: i, is_primary: i === 0 })),
          weight: v.weight === '' ? null : Number(v.weight),
          length: v.length === '' ? null : Number(v.length),
          width: v.width === '' ? null : Number(v.width),
          height: v.height === '' ? null : Number(v.height),
        };
        variantEdits.push({ id: v.id, data: payload });
      }
      if (variants.length === 0) {
        throw new Error('This product has no variant. Create or restore a variant before saving.');
      }

      const productPayload = {
        p_category_id: form.category_id,
        p_name: form.name.trim(),
        p_slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        p_description: form.description,
        p_badge: form.badge || null,
        p_featured: form.featured,
        p_meta_title: form.meta_title || null,
        p_meta_description: form.meta_description || null,
        p_hsn_id: form.hsn_id || null,
        p_collection_ids: selectedCollectionIds,
        p_attribute_value_ids: Object.values(selectedAttributes),
        p_tag_ids: selectedTagIds,
      };
      const { error: saveError } = await supabase.rpc('save_product_edit_atomic', {
        p_data: { product_id: id, product: productPayload, variants: variantEdits, action },
      });
      if (saveError) throw new Error(saveError.message);
      setSuccess(true);
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const allMetadataReady = !metadataLoading && !metadataError && !assignmentsLoading && !assignmentsError;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Edit Product</h2>
            <p className="text-gray-600 mt-1">Update product information</p>
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

        {assignmentsError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {assignmentsError}
          </div>
        )}

        {variantActionSuccess && <p className="mb-4 text-sm text-green-700">{variantActionSuccess}</p>}

        {success && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">Product updated successfully! Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-8 space-y-8">
          <details open className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">01 · Basic product details</summary>
            <div className="p-5 space-y-5">
          {/* Product Name & Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Product Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Slug</label>
              <input type="text" name="slug" value={form.slug} onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
            </div>
          </div>

          {/* Category Hierarchy & SKU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Product Category</label>
              <CategorySelector value={form.category_id} onChange={handleCategoryChange} disabled={true} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">SKU</label>
              <input type="text" value={form.sku} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 font-mono" />
            </div>
          </div>

            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">02 · Collections</summary>
            <div className="p-5 space-y-5">
          {/* Collections */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Collections</label>
            <p className="text-xs text-gray-500 mb-3">A product can belong to multiple collections.</p>
            {collections.length === 0 ? (
              <p className="text-sm text-gray-500">No active collections available.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {collections.map((collection) => {
                  const checked = selectedCollectionIds.includes(collection.id);
                  return (
                    <label
                      key={collection.id}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedCollectionIds((prev) =>
                            e.target.checked ? [...prev, collection.id] : prev.filter((cid) => cid !== collection.id)
                          );
                        }}
                        disabled={saving}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm font-medium">{collection.name}</span>
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
            <div className="p-5 space-y-5">
          {/* Product Attributes */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Product Attributes</h3>
            <p className="text-xs text-gray-500 mb-4">Select the properties that describe this product.</p>

            <input type="search" value={sharedAttributeSearch} onChange={e => setSharedAttributeSearch(e.target.value)} placeholder="Search shared attributes..." className="w-full border rounded-lg px-3 py-2 mb-4" />
            {metadataLoading ? (
              <p className="text-sm text-gray-500">Loading attributes...</p>
            ) : assignmentsLoading ? (
              <p className="text-sm text-gray-500">Loading existing selections...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {attributeTypes.filter((at) => (at.active || selectedAttributes[at.id]) && !existingVariantTypeIds.includes(at.id) && (at.name.toLowerCase().includes(sharedAttributeSearch.toLowerCase()) || selectedAttributes[at.id] !== undefined)).map((attribute) => {
                  const selectedValueId = selectedAttributes[attribute.id];
                  const selectedValue = attribute.attribute_values.find((v) => v.id === selectedValueId);
                  const isInactiveAttr = !attribute.active;
                  const isInactiveValue = selectedValue && !selectedValue.active;

                  return (
                    <div key={attribute.id}>
                      <label className="block text-sm font-medium mb-2">
                        {attribute.name}
                        {isInactiveAttr && (
                          <span className="ml-2 text-xs font-normal text-gray-400">(Inactive)</span>
                        )}
                      </label>
                      <select
                        value={selectedValueId ?? ''}
                        onChange={(e) => {
                          const valueId = Number(e.target.value);
                          setSelectedAttributes((prev) => {
                            const updated = { ...prev };
                            if (e.target.value === '') {
                              delete updated[attribute.id];
                            } else {
                              updated[attribute.id] = valueId;
                            }
                            return updated;
                          });
                        }}
                        disabled={saving}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="">Select {attribute.name}</option>
                        {attribute.attribute_values.map((value) => {
                          const isSelectedInactive = value.id === selectedValueId && !value.active;
                          return (
                            <option key={value.id} value={value.id}>
                              {value.value}{isSelectedInactive ? ' (Inactive)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {isInactiveValue && (
                        <p className="mt-1 text-xs text-gray-400">
                          This attribute value is inactive but preserved from the existing assignment.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            </div>
          </details>

          <details open className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">04 · Pricing, inventory & variants</summary>
            <div className="p-5 space-y-5">
          {/* Variant-backed pricing and inventory */}
          {variantLoading ? <p className="text-sm text-gray-500">Loading variants...</p> : variantError ?
            <p className="text-sm text-red-700">{variantError}</p> : variants.length > 0 ? (
            <section className="border-t pt-6 space-y-4">
              <h3 className="text-lg font-semibold">Pricing, Inventory & Variants ({variants.length})</h3>
              <p className="text-xs text-gray-500">Prices, inventory and images are saved per variant. Existing variant SKUs and attribute combinations are preserved.</p>
              {productStatus === 'published' && hasUnsavedVariantEdits && (
                <p className="text-sm text-amber-700">Save pending variant edits before changing status or the default variant.</p>
              )}
              {isSingleUnconfiguredVariant && (productStatus === 'draft' || (productStatus === 'published' && form.is_active)) && (
                <div className="border rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold">Configure variant attributes</h4>
                  <p className="text-sm text-gray-600">Choose attributes for the existing variant, then add more combinations. The existing variant ID, SKU, prices, stock and images are retained. Shared product attributes cannot be used for variants.</p>
                  <input type="search" value={variantAttributeSearch} onChange={e => setVariantAttributeSearch(e.target.value)} placeholder="Search Color, Size, Material..." className="w-full border rounded-lg px-3 py-2" />
                  <div className="flex flex-wrap gap-2">
                    {availableMigrationTypes.filter(type => type.name.toLowerCase().includes(variantAttributeSearch.toLowerCase()) && !migrationTypeIds.includes(type.id)).slice(0,12).map(type => (
                      <button key={type.id} type="button" disabled={saving || migrationLoading} onClick={() => {setMigrationTypeIds(prev => [...prev,type.id]);setVariantAttributeSearch('');}} className="border rounded-lg px-3 py-1.5 text-sm">+ {type.name}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {migrationTypeIds.map(typeId => {
                      const type = attributeTypes.find(t => t.id === typeId);
                      if (!type) return null;
                      return <label key={typeId} className="border rounded-lg p-3 text-sm">
                        <span className="flex justify-between gap-2 font-medium">{type.name}<button type="button" className="text-red-600" onClick={() => setMigrationTypeIds(prev => prev.filter(x => x !== typeId))}>Remove</button></span>
                        <select className="w-full border rounded-lg px-3 py-2 mt-2" value={migrationValues[variants[0].id]?.[typeId] || ''} onChange={e => setMigrationValues(prev => ({...prev,[variants[0].id]: {...prev[variants[0].id],[typeId]:Number(e.target.value)}}))}>
                          <option value="">Choose {type.name} for {variants[0].sku}</option>
                          {type.attribute_values.filter(value => value.active).map(value => <option key={value.id} value={value.id}>{value.value}</option>)}
                        </select>
                      </label>;
                    })}
                  </div>
                  <button type="button" disabled={!migrationTypeIds.length || migrationLoading || saving || uploading || hasUnsavedVariantEdits || !allMetadataReady} onClick={migrateVariantStructure} className="px-4 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50">{migrationLoading ? 'Converting...' : 'Convert to Variable Product'}</button>
                </div>
              )}
              {(productStatus === 'draft' || (productStatus === 'published' && form.is_active)) && variableAttributeTypes.length > 0 && (
                <div className="border rounded-lg p-4 space-y-4">
                  <button type="button" onClick={() => setShowAddVariant(prev => !prev)}
                    disabled={saving || addingVariant || uploading || !!variantActionId || hasUnsavedVariantEdits || variantOptionsLoading}
                    className="px-4 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50">
                    {showAddVariant ? 'Close Add Variant' : '+ Add Variant'}
                  </button>
                  {showAddVariant && (
                    <div className="space-y-4 border-t pt-4">
                      <p className="text-sm text-gray-600">Select any active value from the existing variant attribute types. New values are assigned to this product atomically when the variant is created. SKU is generated automatically. Draft variants can omit pricing and images; published variants require both. Save product-level changes separately first.</p>
                      <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                        <p className="font-medium text-sm">Copy Variant Details (optional)</p>
                        <p className="text-xs text-gray-600">Copy pricing, dimensions and image references from another variant. The new variant's attribute selections, ID and SKU are never copied. Stock is optional.</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <select aria-label="Source variant for copying" value={copySourceVariantId} onChange={e => setCopySourceVariantId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48">
                            <option value="">Select source variant</option>
                            {variants.map(v => <option key={v.id} value={v.id}>{v.sku}</option>)}
                          </select>
                          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={copyStock} onChange={e => setCopyStock(e.target.checked)} /> Include stock</label>
                          <button type="button" onClick={copyVariantDetails} disabled={!copySourceVariantId || addingVariant || saving || uploading} className="px-4 py-2 border border-[#960018] text-[#960018] rounded-lg disabled:opacity-50">Copy Variant Details</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {variableAttributeTypes.map(type => (
                          <label key={type.id} className="block text-sm font-medium">{type.name} *
                            <select value={newVariant.attributeValueIds[type.id] || ''}
                              onChange={e => setNewVariant(prev => ({...prev, attributeValueIds: {...prev.attributeValueIds, [type.id]: Number(e.target.value)}}))}
                              className="mt-2 w-full px-3 py-2 border rounded-lg">
                              <option value="">Select {type.name}</option>
                              {type.allowedValues.map(value =>
                                <option key={value.id} value={value.id}>{value.value}{variantOptionIds.includes(value.id) ? '' : ' (new to product)'}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {([['buyingPrice','Buying Price'],['mrp','MRP'],['discountPercentage','Discount %'],['sellingPrice','Selling Price']] as const).map(([field,label]) => (
                          <label key={field} className="text-sm font-medium">{label}
                            <input type="number" min="0" step="0.01" value={newVariant[field]}
                              onChange={e => updateNewVariantPricing(field,e.target.value)}
                              className="mt-2 w-full px-3 py-2 border rounded-lg" />
                          </label>
                        ))}
                        <label className="text-sm font-medium">Stock Quantity
                          <input type="number" min="0" step="1" value={newVariant.stock}
                            onChange={e => setNewVariant(prev => ({...prev,stock:e.target.value}))}
                            className="mt-2 w-full px-3 py-2 border rounded-lg" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {([['weight','Weight (g)'],['length','Length (cm)'],['width','Width (cm)'],['height','Height (cm)']] as const).map(([field,label]) => (
                          <label key={field} className="text-sm">{label}
                            <input type="number" min="0" step="any" value={newVariant[field]}
                              onChange={e => setNewVariant(prev => ({...prev,[field]:e.target.value}))}
                              className="mt-2 w-full px-3 py-2 border rounded-lg" />
                          </label>
                        ))}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Variant Images *</label>
                        <input type="file" accept="image/*" multiple disabled={uploading || addingVariant}
                          onChange={async e => { const files=Array.from(e.target.files||[]);e.target.value='';for(const file of files) await uploadNewVariantImage(file); }} />
                        <div className="grid grid-cols-3 gap-3 mt-3">
                          {newVariant.images.map((img,index) => (
                            <div key={img.mediaId} className="relative">
                              <img src={img.url} alt={`New variant image ${index+1}`} className="w-full h-28 object-cover rounded" />
                              {index === 0 && <span className="absolute bottom-1 left-1 bg-white/90 text-xs px-1">Primary</span>}
                              <button type="button" className="absolute top-1 right-1 bg-red-600 text-white rounded p-1"
                                onClick={() => setNewVariant(prev => ({...prev,images:prev.images.filter(x=>x.mediaId!==img.mediaId)}))}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={addVariant}
                        disabled={addingVariant || uploading || saving || variantOptionsLoading || hasUnsavedVariantEdits}
                        className="px-4 py-2 bg-[#960018] text-white rounded-lg disabled:opacity-50">
                        {addingVariant ? 'Creating Variant...' : productStatus === 'draft' ? 'Create Draft Variant' : 'Create & Publish Variant'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {variants.map(v => (
                <div key={v.id} className="border rounded-lg overflow-hidden">
                  <button type="button" className="w-full text-left px-4 py-3 bg-gray-50 flex justify-between items-center"
                    onClick={()=>setExpandedVariant(expandedVariant===v.id?null:v.id)}>
                    <span className="font-medium font-mono">{v.sku} {v.isDefault && <span className="text-xs text-blue-700">(Default)</span>}</span>
                    <span className="text-xs text-gray-500">{v.status} {expandedVariant===v.id?'▲':'▼'}</span>
                  </button>
                  {expandedVariant===v.id && <div className="p-4 space-y-4">
                    {productStatus === 'published' && (
                      <div className="flex flex-wrap gap-2">
                        {v.status === 'published' && !v.isDefault && (
                          <button type="button" disabled={saving || !!variantActionId || hasUnsavedVariantEdits}
                            onClick={() => manageVariantState(v, 'set_default')}
                            className="px-3 py-2 text-sm border border-blue-600 text-blue-700 rounded-lg disabled:opacity-50">
                            Set as Default
                          </button>
                        )}
                        {v.status === 'published' && !v.isDefault && (
                          <button type="button" disabled={saving || !!variantActionId || hasUnsavedVariantEdits}
                            onClick={() => manageVariantState(v, 'deactivate')}
                            className="px-3 py-2 text-sm border border-red-600 text-red-700 rounded-lg disabled:opacity-50">
                            Deactivate
                          </button>
                        )}
                        {v.status === 'inactive' && (
                          <button type="button" disabled={saving || !!variantActionId || hasUnsavedVariantEdits}
                            onClick={() => manageVariantState(v, 'activate')}
                            className="px-3 py-2 text-sm border border-green-600 text-green-700 rounded-lg disabled:opacity-50">
                            Activate
                          </button>
                        )}
                        {v.isDefault && <span className="text-xs text-gray-600 self-center">Change the default before deactivating this variant.</span>}
                        {variantActionId === v.id && <span className="text-sm text-gray-500 self-center">Updating...</span>}
                      </div>
                    )}
                    {v.attributeValueIds.length>0 && <div className="text-sm text-gray-600">Attributes: {v.attributeValueIds.map(valueId=>{
                      const value=attributeTypes.flatMap(t=>t.attribute_values.map(av=>({type:t.name,...av}))).find(x=>x.id===valueId);
                      return value ? `${value.type}: ${value.value}` : `#${valueId}`;
                    }).join(' · ')}</div>}
                    <div className="grid grid-cols-2 gap-4">
                      {([['buyingPrice','Buying Price'],['mrp','MRP'],['discountPercentage','Discount %'],['sellingPrice','Selling Price']] as const).map(([field,label])=>(
                        <label key={field} className="block text-sm font-medium">{label}
                          <input type="number" step="0.01" min="0" max={field==='discountPercentage'?100:undefined}
                            value={v[field]} disabled={saving} onChange={e=>setVariants(prev=>prev.map(x=>x.id===v.id?editPricing(x,field,e.target.value):x))}
                            className="mt-2 w-full px-4 py-2 border rounded-lg" />
                        </label>
                      ))}
                      <label className="block text-sm font-medium">Stock Quantity
                        <input type="number" min="0" step="1" value={v.stock} disabled={saving}
                          onChange={e=>changeVariant(v.id,{stock:e.target.value})} className="mt-2 w-full px-4 py-2 border rounded-lg" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {([['weight','Weight (g)'],['length','Length (cm)'],['width','Width (cm)'],['height','Height (cm)']] as const).map(([field,label])=>(
                        <label key={field} className="text-sm">{label}
                          <input type="number" min="0" step="any" value={v[field]} disabled={saving}
                            onChange={e=>changeVariant(v.id,{[field]:e.target.value})} className="mt-2 w-full px-3 py-2 border rounded-lg" />
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Variant Images</label>
                      <input type="file" accept="image/*" multiple disabled={saving||uploading}
                        onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';for(const file of files)await uploadVariantImage(v.id,file)}}
                        className="block text-sm mb-3" />
                      <div className="grid grid-cols-3 gap-3">
                        {v.images.map((img,i)=><div key={img.mediaId} className="relative">
                          <img src={img.url} alt={`${v.sku} image ${i+1}`} className="w-full h-28 object-cover rounded-lg" />
                          {i===0 && <span className="absolute bottom-1 left-1 bg-white/90 text-xs px-1 rounded">Primary</span>}
                          <button type="button" disabled={saving} onClick={()=>changeVariant(v.id,{images:v.images.filter(x=>x.mediaId!==img.mediaId)})}
                            className="absolute top-1 right-1 p-1 rounded bg-red-600 text-white"><Trash2 className="w-4 h-4" /></button>
                        </div>)}
                      </div>
                    </div>
                  </div>}
                </div>
              ))}
            </section>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No variants are linked to this product. Product pricing, inventory, dimensions and images are managed through variants. Add or restore a variant before saving this product.
            </div>
          )}

            </div>
          </details>

          <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <summary className="cursor-pointer select-none px-5 py-4 font-semibold text-gray-900 bg-gray-50">05 · Product tags</summary>
            <div className="p-5 space-y-5">
          {/* Product Tags */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Product Tags</h3>
            <p className="text-xs text-gray-500 mb-3">Optional. Search and select multiple tags.</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {tags
                .filter((tag) => selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <span
                    key={tag.id}
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                      tag.active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {tag.name}
                    {!tag.active && <span className="text-xs text-gray-400">(Inactive)</span>}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setSelectedTagIds((prev) => prev.filter((tid) => tid !== tag.id))}
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
                disabled={saving || metadataLoading || assignmentsLoading || tagProcessing}
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
                {filteredTagOptions.slice(0, 20).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSelectedTagIds((prev) => [...prev, tag.id]);
                      setTagSearch('');
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {tagSearch.trim() !== '' && filteredTagOptions.length === 0 && !tagAction && !tagProcessing && (
              <p className="mt-2 text-xs text-gray-500">No matching tags found. Click the button to create a new one.</p>
            )}

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
                    <button type="button" onClick={() => selectTag(tagAction.tag)} disabled={tagProcessing}
                      className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition text-sm font-medium disabled:opacity-50">
                      Use Existing
                    </button>
                    <button type="button" onClick={() => doCreateTag(tagAction.name, tagAction.slug)} disabled={tagProcessing}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition text-sm font-medium disabled:opacity-50">
                      {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Create Anyway
                    </button>
                    <button type="button" onClick={() => setTagAction(null)} disabled={tagProcessing}
                      className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium">
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
                    <button type="button" onClick={() => doReactivateTag(tagAction.tag)} disabled={tagProcessing}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition text-sm font-medium disabled:opacity-50">
                      {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Reactivate Existing
                    </button>
                    <button type="button" onClick={() => doCreateTag(tagAction.name, tagAction.slug)} disabled={tagProcessing}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition text-sm font-medium disabled:opacity-50">
                      {tagProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Create New
                    </button>
                    <button type="button" onClick={() => setTagAction(null)} disabled={tagProcessing}
                      className="px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium">
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
          <div className="grid grid-cols-2 gap-4">
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

          {/* Stock & Badge */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Badge</label>
              <input type="text" name="badge" value={form.badge} onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description *</label>
            <textarea name="description" value={form.description} onChange={handleInputChange} rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" disabled={saving} />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" checked={form.featured} onChange={handleInputChange}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" disabled={saving} />
              <span className="text-sm font-medium text-gray-900">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={productStatus !== 'draft' && form.is_active}
                onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                disabled={saving || productStatus === 'draft'}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Active</span>
              {productStatus === 'draft' && <span className="text-xs text-gray-500">(Publish to activate)</span>}
            </label>
          </div>

          {/* SEO */}
          <details className="border rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-900 hover:bg-gray-50">SEO & Metadata</summary>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Meta Title</label>
                <input type="text" name="meta_title" value={form.meta_title} onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={saving} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Meta Description</label>
                <textarea name="meta_description" value={form.meta_description} onChange={handleInputChange} rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" disabled={saving} />
              </div>
            </div>
          </details>

          {/* Product dimensions are maintained per variant above. */}
          {/* Images */}
            </div>
          </details>

          {/* Explicit publication workflow: never change state when merely editing. */}
          <div className="flex flex-wrap gap-3 pt-4">
            <button type="button" onClick={() => navigate('/admin')} disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
              Cancel
            </button>
            {(productStatus === 'draft' ? [
              { action: 'save_draft', label: 'Save Draft' },
              { action: 'publish', label: 'Publish' },
            ] : [
              { action: 'save_changes', label: form.is_active === (productStatus === 'published') ? 'Save Changes' : form.is_active ? 'Save Changes & Activate' : 'Save Changes & Deactivate' },
            ]).map(({action,label}) => (
              <button key={action} type="submit" onClick={() => setSubmitAction(action as typeof submitAction)}
                disabled={saving || addingVariant || migrationLoading || uploading || variantLoading || !!variantError || !allMetadataReady}
                className={`px-5 py-2 rounded-lg text-white disabled:opacity-50 ${action === 'set_inactive' ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saving ? 'Saving...' : label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
