
import * as XLSX from 'xlsx';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Search,
  Star,
  RefreshCw,
  ArrowUpDown,
  Package,
  Boxes,
  IndianRupee,
  X,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';

type Hsn = {
  id: string;
  hsn_code: string;
  gst_percentage: number;
};

type AdminProduct = {
  id: string;
  name: string;
  description: string;
  slug: string | null;
  sku: string | null;
  badge: string | null;
  featured: boolean;
  is_active: boolean;
  status: string;
  created_at: string | null;
  category_id: number | null;
  default_variant_id: string | null;
  hsn_id: string | null;
  hsn_code: string | null;
  gst_percentage: number | null;
  hsn_master: Hsn | null;
  category_name: string;
  images: string[];
  price: number | null;
  sale_price: number | null;
  buying_price: number | null;
  stock_quantity: number;
  variant_count: number;
};

type ProductStatusFilter = 'all' | 'active' | 'inactive' | 'featured';
type StockFilter = 'all' | 'low' | 'out';

const LOW_STOCK_THRESHOLD = 5;

const formatINR = (amount: number | null | undefined) => {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return 'Not set';
  }

  return `₹${Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred.';

export default function AdminProducts() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] =
    useState<ProductStatusFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState('newest');

  const [deleteConfirm, setDeleteConfirm] = useState<AdminProduct | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: rows, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          slug,
          sku,
          badge,
          featured,
          is_active,
          status,
          created_at,
          category_id,
          default_variant_id,
          hsn_id,
          hsn_code,
          gst_percentage,
          hsn_master!products_hsn_id_fkey (
            id,
            hsn_code,
            gst_percentage
          )
        `)
        .order('created_at', { ascending: false });

      if (productError) throw productError;

      const productRows = (rows ?? []) as unknown as Array<
        Omit<AdminProduct, 'category_name' | 'images' | 'price' |
          'sale_price' | 'buying_price' | 'stock_quantity' |
          'variant_count'> & {
          hsn_master: Hsn | Hsn[] | null;
        }
      >;

      if (productRows.length === 0) {
        setProducts([]);
        return;
      }

      const productIds = productRows.map((p) => p.id);
      const { data: variants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, product_id, sku, is_active, status')
        .in('product_id', productIds);

      if (variantError) throw variantError;

      const allVariants = variants ?? [];
      const variantIds = [...new Set(allVariants.map((v) => v.id))];

      const [
        priceResult,
        inventoryResult,
        mediaResult,
        categoryResult,
      ] = await Promise.all([
        variantIds.length
          ? supabase
              .from('variant_prices')
              .select(`
                variant_id,
                currency_code,
                buying_price,
                mrp,
                selling_price,
                discount_percentage,
                effective_from,
                effective_to
              `)
              .in('variant_id', variantIds)
              .eq('currency_code', 'INR')
              .is('effective_to', null)
          : Promise.resolve({ data: [], error: null }),

        variantIds.length
          ? supabase
              .from('variant_inventory')
              .select('variant_id, stock_quantity, reserved_quantity')
              .in('variant_id', variantIds)
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from('product_media')
          .select(`
            product_id,
            sort_order,
            is_primary,
            media_assets!product_media_media_id_fkey (
              public_url
            )
          `)
          .in('product_id', productIds)
          .order('sort_order', { ascending: true }),

        supabase
          .from('categories')
          .select('id, name'),
      ]);

      if (priceResult.error) throw priceResult.error;
      if (inventoryResult.error) throw inventoryResult.error;
      if (mediaResult.error) throw mediaResult.error;
      if (categoryResult.error) throw categoryResult.error;

      const prices = priceResult.data ?? [];
      const inventory = inventoryResult.data ?? [];
      const media = mediaResult.data ?? [];
      const categories = categoryResult.data ?? [];

      const categoryMap = new Map<number, string>(
        categories.map((category) => [category.id, category.name])
      );

      const mapped: AdminProduct[] = productRows.map((product) => {
        const productVariants = allVariants.filter(
          (variant) => variant.product_id === product.id
        );

        const selectedVariant =
          productVariants.find(
            (variant) => variant.id === product.default_variant_id
          ) ?? productVariants[0];

        const activePrices = selectedVariant
          ? prices
              .filter((price) => price.variant_id === selectedVariant.id)
              .filter(
                (price) =>
                  !price.effective_to ||
                  new Date(price.effective_to).getTime() > Date.now()
              )
              .sort(
                (a, b) =>
                  new Date(b.effective_from).getTime() -
                  new Date(a.effective_from).getTime()
              )
          : [];

        const selectedPrice = activePrices[0];

        const stockQuantity = productVariants.reduce((total, variant) => {
          const row = inventory.find(
            (item) => item.variant_id === variant.id
          );
          return total + (row?.stock_quantity ?? 0);
        }, 0);

        const productImages = media
          .filter((item) => item.product_id === product.id)
          .sort(
            (a, b) =>
              Number(b.is_primary) - Number(a.is_primary) ||
              a.sort_order - b.sort_order
          )
          .map((item) => {
            const asset = Array.isArray(item.media_assets)
              ? item.media_assets[0]
              : item.media_assets;

            return asset?.public_url ?? '';
          })
          .filter(Boolean);

        const hsn = Array.isArray(product.hsn_master)
          ? product.hsn_master[0] ?? null
          : product.hsn_master ?? null;

        return {
          ...product,
          hsn_master: hsn,
          category_name: product.category_id
            ? categoryMap.get(product.category_id) ?? 'Uncategorised'
            : 'Uncategorised',
          images: productImages,
          price: selectedPrice?.mrp ?? null,
          sale_price: selectedPrice?.selling_price ?? null,
          buying_price: selectedPrice?.buying_price ?? null,
          stock_quantity: stockQuantity,
          variant_count: productVariants.length,
        };
      });

      setProducts(mapped);
    } catch (err) {
      console.error('Failed to load admin products:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(
    () =>
      [...new Set(products.map((p) => p.category_name))]
        .filter((name) => name && name !== 'Uncategorised')
        .sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const lowStockCount = products.filter(
    (p) =>
      p.stock_quantity > 0 &&
      p.stock_quantity <= LOW_STOCK_THRESHOLD
  ).length;

  const outOfStockCount = products.filter(
    (p) => p.stock_quantity === 0
  ).length;

  const activeCount = products.filter((p) => p.is_active).length;
  const featuredCount = products.filter((p) => p.featured).length;

  const displayProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.sku ?? '').toLowerCase().includes(term) ||
        (product.slug ?? '').toLowerCase().includes(term) ||
        product.id.toLowerCase().includes(term) ||
        (product.hsn_master?.hsn_code ?? product.hsn_code ?? '')
          .toLowerCase()
          .includes(term);

      const matchesCategory =
        categoryFilter === 'all' ||
        product.category_name === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active) ||
        (statusFilter === 'featured' && product.featured);

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' &&
          product.stock_quantity > 0 &&
          product.stock_quantity <= LOW_STOCK_THRESHOLD) ||
        (stockFilter === 'out' && product.stock_quantity === 0);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesStock
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-low':
          return (a.sale_price ?? a.price ?? Infinity) -
            (b.sale_price ?? b.price ?? Infinity);
        case 'price-high':
          return (b.sale_price ?? b.price ?? -Infinity) -
            (a.sale_price ?? a.price ?? -Infinity);
        case 'stock-low':
          return a.stock_quantity - b.stock_quantity;
        case 'stock-high':
          return b.stock_quantity - a.stock_quantity;
        case 'oldest':
          return (
            new Date(a.created_at ?? 0).getTime() -
            new Date(b.created_at ?? 0).getTime()
          );
        case 'newest':
        default:
          return (
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
          );
      }
    });
  }, [
    products,
    searchTerm,
    categoryFilter,
    statusFilter,
    stockFilter,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setStockFilter('all');
    setSortBy('newest');
  };

  const handleExportProducts = () => {
    try {
      if (displayProducts.length === 0) {
        setError('There are no matching products to export.');
        return;
      }

      setError(null);

      const exportData = displayProducts.map((product) => ({
        'Product ID': product.id,
        SKU: product.sku ?? '',
        'Product Name': product.name,
        Category: product.category_name,
        HSN: product.hsn_master?.hsn_code ?? product.hsn_code ?? '',
        'GST %':
          product.hsn_master?.gst_percentage ??
          product.gst_percentage ??
          '',
        'MRP (INR)': product.price ?? '',
        'Selling Price (INR)': product.sale_price ?? '',
        'Buying Price (INR)': product.buying_price ?? '',
        Stock: product.stock_quantity,
        Variants: product.variant_count,
        Featured: product.featured ? 'Yes' : 'No',
        Active: product.is_active ? 'Yes' : 'No',
        Status: product.status,
        Slug: product.slug ?? '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      worksheet['!cols'] = [
        { wch: 22 },
        { wch: 20 },
        { wch: 35 },
        { wch: 22 },
        { wch: 15 },
        { wch: 10 },
        { wch: 16 },
        { wch: 20 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 30 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `carmin-products-${today}.xlsx`);

      setSuccess('Product export downloaded successfully.');
    } catch (err) {
      console.error('Product export failed:', err);
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const product = deleteConfirm;

    try {
      setDeleting(true);
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (deleteError) throw deleteError;

      setProducts((current) =>
        current.filter((p) => p.id !== product.id)
      );
      setDeleteConfirm(null);
      setSuccess(`"${product.name}" was deleted.`);
    } catch (err) {
      console.error('Product deletion failed:', err);
      setError(
        `${getErrorMessage(err)} If this product has variants or order references, check the related foreign-key constraints before deleting it.`
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (product: AdminProduct) => {
    try {
      setUpdatingId(product.id);
      setError(null);
      setSuccess(null);

      const nextValue = !product.is_active;

      const { error: updateError } = await supabase
        .from('products')
        .update({ is_active: nextValue })
        .eq('id', product.id);

      if (updateError) throw updateError;

      setProducts((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, is_active: nextValue } : p
        )
      );

      setSuccess(
        nextValue
          ? `"${product.name}" is now active.`
          : `"${product.name}" is now inactive.`
      );
    } catch (err) {
      console.error('Product status update failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleFeatured = async (product: AdminProduct) => {
    try {
      setUpdatingId(product.id);
      setError(null);
      setSuccess(null);

      const nextValue = !product.featured;

      const { error: updateError } = await supabase
        .from('products')
        .update({ featured: nextValue })
        .eq('id', product.id);

      if (updateError) throw updateError;

      setProducts((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, featured: nextValue } : p
        )
      );

      setSuccess(
        nextValue
          ? `"${product.name}" is featured.`
          : `"${product.name}" is no longer featured.`
      );
    } catch (err) {
      console.error('Featured update failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const hasFilters =
    searchTerm !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    stockFilter !== 'all' ||
    sortBy !== 'newest';

  return (
    <AdminLayout>
      <div className="space-y-6 text-[#2B1F3D]">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#960018]">
              Carmin administration
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#2B1F3D]">
              Products
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your catalogue, pricing, inventory and visibility.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchProducts()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handleExportProducts}
              disabled={loading || displayProducts.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/products/add')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#960018] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#780014]"
            >
              <Plus className="h-4 w-4" />
              Add product
            </button>
          </div>
        </div>

        {/* Alerts */}
        {(outOfStockCount > 0 || lowStockCount > 0) && (
          <div className="flex flex-wrap gap-3">
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('out')}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition ${
                  stockFilter === 'out'
                    ? 'border-red-300 bg-red-100'
                    : 'border-red-200 bg-red-50 hover:bg-red-100'
                }`}
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">
                  {outOfStockCount} out of stock
                </span>
              </button>
            )}

            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setStockFilter((current) =>
                    current === 'low' ? 'all' : 'low'
                  )
                }
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition ${
                  stockFilter === 'low'
                    ? 'border-amber-300 bg-amber-100'
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="font-medium text-amber-900">
                  {lowStockCount} low stock
                </span>
              </button>
            )}
          </div>
        )}

        {/* Success / error messages */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm text-red-800">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="text-red-700 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4"
          >
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div className="flex-1 text-sm text-green-800">{success}</div>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Dismiss success message"
              className="text-green-700 hover:text-green-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Total products</span>
              <Package className="h-5 w-5 text-[#960018]" />
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {loading ? '—' : products.length}
            </p>
            <p className="mt-1 text-xs text-gray-400">Across your catalogue</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Active products</span>
              <Eye className="h-5 w-5 text-green-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {loading ? '—' : activeCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">Currently enabled</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Featured</span>
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {loading ? '—' : featuredCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">Featured products</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Low / no stock</span>
              <Boxes className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {loading ? '—' : lowStockCount + outOfStockCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Based on combined variant stock
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search product name, SKU, slug, ID or HSN..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#960018] focus:ring-2 focus:ring-[#960018]/10"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#960018]"
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as ProductStatusFilter)
                }
                className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#960018]"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="featured">Featured</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#960018]"
                aria-label="Sort products"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="stock-low">Stock: low to high</option>
                <option value="stock-high">Stock: high to low</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">
                Stock filter:
              </span>
              {([
                ['all', 'All stock'],
                ['low', 'Low stock'],
                ['out', 'Out of stock'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStockFilter(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    stockFilter === value
                      ? 'bg-[#960018] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Showing {displayProducts.length} of {products.length}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-medium text-[#960018] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product table */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#960018]" />
              <p className="text-sm text-gray-500">
                Loading your products...
              </p>
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Package className="h-7 w-7 text-gray-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-800">
                {products.length === 0
                  ? 'No products yet'
                  : 'No matching products'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {products.length === 0
                  ? 'Add your first product to start building your catalogue.'
                  : 'Try changing your search or filters.'}
              </p>
              {products.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/admin/products/add')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#960018] px-4 py-2 text-sm font-medium text-white hover:bg-[#780014]"
                >
                  <Plus className="h-4 w-4" />
                  Add product
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 text-sm font-medium text-[#960018] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="border-b border-gray-100 bg-gray-50/80">
                  <tr>
                    {[
                      'Product',
                      'Category / HSN',
                      'Price',
                      'Stock',
                      'Status',
                      'Actions',
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {displayProducts.map((product) => {
                    const isLow =
                      product.stock_quantity > 0 &&
                      product.stock_quantity <= LOW_STOCK_THRESHOLD;
                    const isOut = product.stock_quantity === 0;
                    const isUpdating = updatingId === product.id;

                    return (
                      <tr
                        key={product.id}
                        className={`transition hover:bg-[#960018]/[0.025] ${
                          !product.is_active ? 'bg-gray-50/70' : ''
                        }`}
                      >
                        {/* Product */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                loading="lazy"
                                className="h-14 w-14 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                                <Package className="h-6 w-6 text-gray-300" />
                              </div>
                            )}

                            <div className="max-w-xs min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-[#2B1F3D]">
                                  {product.name}
                                </p>
                                {product.featured && (
                                  <Star
                                    className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500"
                                    aria-label="Featured"
                                  />
                                )}
                              </div>

                              <p className="mt-1 text-xs text-gray-500">
                                SKU: {product.sku || 'Not set'}
                              </p>

                              <p className="mt-0.5 truncate text-xs text-gray-400">
                                ID: {product.id}
                              </p>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {product.badge && (
                                  <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                                    {product.badge}
                                  </span>
                                )}
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                                  {product.variant_count} variant
                                  {product.variant_count === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category and HSN */}
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-800">
                            {product.category_name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            HSN:{' '}
                            {product.hsn_master?.hsn_code ??
                              product.hsn_code ??
                              'Not set'}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            GST:{' '}
                            {product.hsn_master?.gst_percentage ??
                              product.gst_percentage ??
                              '—'}
                            %
                          </p>
                        </td>

                        {/* Pricing */}
                        <td className="px-4 py-4">
                          {product.price == null ? (
                            <div>
                              <p className="text-sm text-gray-400">
                                Price not set
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                Check variant pricing
                              </p>
                            </div>
                          ) : (
                            <div>
                              {product.sale_price != null &&
                              product.sale_price < product.price ? (
                                <>
                                  <p className="text-sm font-semibold text-[#960018]">
                                    {formatINR(product.sale_price)}
                                  </p>
                                  <p className="mt-0.5 text-xs text-gray-400 line-through">
                                    {formatINR(product.price)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm font-semibold text-gray-800">
                                  {formatINR(product.price)}
                                </p>
                              )}
                              {product.buying_price != null && (
                                <p className="mt-1 text-xs text-gray-400">
                                  Cost: {formatINR(product.buying_price)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Inventory */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`text-sm font-semibold ${
                                isOut
                                  ? 'text-red-600'
                                  : isLow
                                    ? 'text-amber-600'
                                    : 'text-green-700'
                              }`}
                            >
                              {product.stock_quantity}
                            </span>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isOut
                                  ? 'bg-red-50 text-red-700'
                                  : isLow
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-green-50 text-green-700'
                              }`}
                            >
                              {isOut
                                ? 'Out of stock'
                                : isLow
                                  ? 'Low stock'
                                  : 'In stock'}
                            </span>
                          </div>
                        </td>

                        {/* Status controls */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleActive(product)}
                              disabled={isUpdating}
                              title={
                                product.is_active
                                  ? 'Deactivate product'
                                  : 'Activate product'
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                product.is_active
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {product.is_active ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                              {product.is_active ? 'Active' : 'Inactive'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleFeatured(product)}
                              disabled={isUpdating}
                              title={
                                product.featured
                                  ? 'Remove from featured'
                                  : 'Mark as featured'
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                                product.featured
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              <Star
                                className={`h-3.5 w-3.5 ${
                                  product.featured ? 'fill-current' : ''
                                }`}
                              />
                              {product.featured ? 'Featured' : 'Not featured'}
                            </button>

                            <span className="text-[10px] capitalize text-gray-400">
                              {product.status}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/admin/products/edit/${product.id}`
                                )
                              }
                              className="rounded-lg p-2 text-gray-500 transition hover:bg-purple-50 hover:text-[#35165a]"
                              title="Edit product"
                              aria-label={`Edit ${product.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(product)}
                              className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                              title="Delete product"
                              aria-label={`Delete ${product.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && displayProducts.length > 0 && (
            <div className="flex flex-col justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center">
              <span>
                Displaying {displayProducts.length} of {products.length} products
              </span>
              <span>
                Low stock threshold: {LOW_STOCK_THRESHOLD} units
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteConfirm(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>

            <h2
              id="delete-product-title"
              className="mt-4 text-lg font-semibold text-gray-900"
            >
              Delete product?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              You are about to delete{' '}
              <strong>{deleteConfirm.name}</strong>. This may fail if related
              variants, inventory, media or order records prevent deletion.
              Check those relationships before removing dependent data.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                {deleting ? 'Deleting...' : 'Delete product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
