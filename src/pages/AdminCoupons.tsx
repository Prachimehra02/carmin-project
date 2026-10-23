import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, AlertCircle, Tag, CheckCircle, X, Search,
  Calendar, Users, Percent, IndianRupee, TrendingUp, Eye, Power,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import { Coupon, CouponRedemption } from '../types/order';

const CATEGORIES = [
  { value: 'pots-planters', label: 'Pots & Planters' },
  { value: 'vases', label: 'Vases' },
  { value: 'sculptures', label: 'Sculptures' },
  { value: 'artifacts', label: 'Artifacts' },
  { value: 'decor-accessories', label: 'Decor Accessories' },
  { value: 'wall-decor', label: 'Wall Decor' },
  { value: 'mirrors', label: 'Mirrors' },
  { value: 'new-arrival', label: 'New Arrivals' },
];

type FilterType = 'all' | 'active' | 'inactive' | 'expired' | 'scheduled' | 'most_used';

interface CouponWithUsage extends Coupon {
  used_count: number;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<CouponWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingCoupon, setViewingCoupon] = useState<CouponWithUsage | null>(null);
  const [viewingRedemptions, setViewingRedemptions] = useState<CouponRedemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  const emptyForm = {
    name: '',
    code: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    max_discount_amount: '0',
    minimum_order_amount: '0',
    start_date: '',
    expiry_date: '',
    active: true,
    total_usage_limit: '',
    per_customer_usage_limit: '1',
    first_order_only: false,
    allow_stacking: false,
    applicable_scope: 'entire_store' as Coupon['applicable_scope'],
    applicable_categories: [] as string[],
    applicable_product_ids: [] as string[],
    applicable_customer_ids: [] as string[],
    payment_restriction: 'all' as Coupon['payment_restriction'],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error: err } = await supabase.from('products').select('id, name').order('name');
      if (err) throw err;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: couponData, error: fetchError } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const couponList = (couponData || []) as Coupon[];

      // Fetch usage counts
      const { data: usageData, error: usageError } = await supabase
        .from('coupon_redemptions')
        .select('coupon_id');

      if (usageError) throw usageError;

      const usageMap: Record<string, number> = {};
      (usageData || []).forEach((r: any) => {
        usageMap[r.coupon_id] = (usageMap[r.coupon_id] || 0) + 1;
      });

      const withUsage: CouponWithUsage[] = couponList.map((c) => ({
        ...c,
        used_count: usageMap[c.id] || 0,
      }));

      setCoupons(withUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (coupon: CouponWithUsage) => {
    setEditingId(coupon.id);
    setForm({
      name: coupon.name || '',
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.type,
      value: coupon.value.toString(),
      max_discount_amount: (coupon.max_discount_amount || 0).toString(),
      minimum_order_amount: coupon.minimum_order_amount.toString(),
      start_date: coupon.start_date ? new Date(coupon.start_date).toISOString().slice(0, 16) : '',
      expiry_date: coupon.expiry_date ? new Date(coupon.expiry_date).toISOString().slice(0, 16) : '',
      active: coupon.active,
      total_usage_limit: coupon.total_usage_limit?.toString() || '',
      per_customer_usage_limit: coupon.per_customer_usage_limit?.toString() || '1',
      first_order_only: coupon.first_order_only,
      allow_stacking: coupon.allow_stacking,
      applicable_scope: coupon.applicable_scope,
      applicable_categories: coupon.applicable_categories || [],
      applicable_product_ids: coupon.applicable_product_ids || [],
      applicable_customer_ids: coupon.applicable_customer_ids || [],
      payment_restriction: coupon.payment_restriction,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.code.trim()) { setError('Coupon code is required'); return; }
    if (!form.value || isNaN(Number(form.value)) || Number(form.value) <= 0) {
      setError('Valid discount value is required'); return;
    }
    if (form.applicable_scope === 'specific_categories' && form.applicable_categories.length === 0) {
      setError('Select at least one category'); return;
    }
    if (form.applicable_scope === 'specific_products' && form.applicable_product_ids.length === 0) {
      setError('Select at least one product'); return;
    }

    try {
      setSaving(true);
      const couponData: any = {
        name: form.name.trim() || null,
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        type: form.type,
        value: Number(form.value),
        max_discount_amount: Number(form.max_discount_amount) || 0,
        minimum_order_amount: Number(form.minimum_order_amount) || 0,
        start_date: form.start_date || null,
        expiry_date: form.expiry_date || null,
        active: form.active,
        total_usage_limit: form.total_usage_limit ? Number(form.total_usage_limit) : null,
        per_customer_usage_limit: Number(form.per_customer_usage_limit) || 1,
        first_order_only: form.first_order_only,
        allow_stacking: form.allow_stacking,
        applicable_scope: form.applicable_scope,
        applicable_categories: form.applicable_categories,
        applicable_product_ids: form.applicable_product_ids,
        applicable_customer_ids: form.applicable_customer_ids,
        payment_restriction: form.payment_restriction,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('coupons')
          .insert([couponData]);
        if (insertError) throw insertError;
      }

      setShowForm(false);
      fetchCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon: CouponWithUsage) => {
    try {
      const { error: updateError } = await supabase
        .from('coupons')
        .update({ active: !coupon.active })
        .eq('id', coupon.id);
      if (updateError) throw updateError;
      fetchCoupons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coupon');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
      setCoupons(coupons.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete coupon. It may have existing redemptions.');
    }
  };

  const viewRedemptions = async (coupon: CouponWithUsage) => {
    setViewingCoupon(coupon);
    setLoadingRedemptions(true);
    try {
      const { data, error: err } = await supabase
        .from('coupon_redemptions')
        .select(`
          *,
          order:orders ( order_number, created_at )
        `)
        .eq('coupon_id', coupon.id)
        .order('redeemed_at', { ascending: false });
      if (err) throw err;
      setViewingRedemptions((data || []) as CouponRedemption[]);
    } catch (err) {
      console.error('Error fetching redemptions:', err);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const isExpired = (coupon: Coupon) =>
    coupon.expiry_date ? new Date(coupon.expiry_date) < new Date() : false;

  const isScheduled = (coupon: Coupon) =>
    coupon.start_date ? new Date(coupon.start_date) > new Date() : false;

  const filteredCoupons = useMemo(() => {
    let list = coupons;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          (c.name || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case 'active':
        list = list.filter((c) => c.active && !isExpired(c) && !isScheduled(c));
        break;
      case 'inactive':
        list = list.filter((c) => !c.active);
        break;
      case 'expired':
        list = list.filter((c) => isExpired(c));
        break;
      case 'scheduled':
        list = list.filter((c) => isScheduled(c));
        break;
      case 'most_used':
        list = [...list].sort((a, b) => b.used_count - a.used_count);
        break;
    }

    return list;
  }, [coupons, search, filter]);

  const getStatusBadge = (coupon: CouponWithUsage) => {
    if (!coupon.active) return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">Inactive</span>;
    if (isExpired(coupon)) return <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded">Expired</span>;
    if (isScheduled(coupon)) return <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">Scheduled</span>;
    return <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded">Active</span>;
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      applicable_categories: f.applicable_categories.includes(cat)
        ? f.applicable_categories.filter((c) => c !== cat)
        : [...f.applicable_categories, cat],
    }));
  };

  const toggleProduct = (pid: string) => {
    setForm((f) => ({
      ...f,
      applicable_product_ids: f.applicable_product_ids.includes(pid)
        ? f.applicable_product_ids.filter((p) => p !== pid)
        : [...f.applicable_product_ids, pid],
    }));
  };

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.active && !isExpired(c)).length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + c.used_count, 0);
    const totalDiscount = coupons.reduce((sum, c) => sum + c.used_count, 0);
    return { active, totalRedemptions, totalCoupons: coupons.length, totalDiscount };
  }, [coupons]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Coupons</h2>
            <p className="text-gray-600 mt-1">Manage discount coupons and promotional offers</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Create Coupon
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCoupons}</p>
              <p className="text-sm text-gray-500">Total Coupons</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-sm text-gray-500">Active Coupons</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRedemptions}</p>
              <p className="text-sm text-gray-500">Total Redemptions</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Search & Filters */}
        {!loading && !showForm && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, name, or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Coupons</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="scheduled">Scheduled</option>
              <option value="most_used">Most Used</option>
            </select>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        )}

        {!loading && !showForm && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredCoupons.length === 0 ? (
              <div className="p-12 text-center">
                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No coupons found</p>
                <p className="text-gray-400 text-sm mt-1">
                  {search || filter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first coupon to offer discounts'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Discount</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Min Order</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Start</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Expiry</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Usage</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCoupons.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block w-fit">
                              {coupon.code}
                            </span>
                            {coupon.name && (
                              <span className="text-xs text-gray-500 mt-1">{coupon.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 capitalize text-gray-700">{coupon.type}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                          {coupon.type === 'percentage' && coupon.max_discount_amount > 0 && (
                            <span className="block text-xs text-gray-500">max ₹{coupon.max_discount_amount}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          ₹{Number(coupon.minimum_order_amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {coupon.start_date ? new Date(coupon.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {coupon.expiry_date ? new Date(coupon.expiry_date).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <span className="font-semibold">{coupon.used_count}</span>
                          {coupon.total_usage_limit ? ` / ${coupon.total_usage_limit}` : ''}
                          <button
                            onClick={() => viewRedemptions(coupon)}
                            className="block text-xs text-blue-600 hover:text-blue-800 mt-0.5"
                          >
                            View details
                          </button>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(coupon)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => viewRedemptions(coupon)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="View usage"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(coupon)}
                              className={`p-2 rounded-lg transition ${
                                coupon.active
                                  ? 'text-green-600 hover:bg-green-50'
                                  : 'text-gray-400 hover:bg-gray-100'
                              }`}
                              title={coupon.active ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openEditForm(coupon)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(coupon.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Coupon Form */}
        {!loading && showForm && (
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Coupon' : 'Create Coupon'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Info</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Coupon Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Welcome Offer"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Coupon Code *</label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., WELCOME10"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Internal description for this coupon"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    disabled={saving}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Expiry Date</label>
                    <input
                      type="datetime-local"
                      value={form.expiry_date}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    disabled={saving}
                  />
                  <span className="text-sm font-medium text-gray-900">Active</span>
                </label>
              </div>

              {/* Discount */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Discount</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Discount Type *</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Discount Value * {form.type === 'percentage' ? '(%)' : '(₹)'}
                    </label>
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder={form.type === 'percentage' ? 'e.g., 10' : 'e.g., 500'}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Max Discount Amount (₹) {form.type === 'fixed' && '(N/A)'}
                    </label>
                    <input
                      type="number"
                      value={form.max_discount_amount}
                      onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving || form.type === 'fixed'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Cap for percentage coupons</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Minimum Order Amount (₹)</label>
                    <input
                      type="number"
                      value={form.minimum_order_amount}
                      onChange={(e) => setForm({ ...form, minimum_order_amount: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {/* Usage */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Usage Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Total Usage Limit</label>
                    <input
                      type="number"
                      value={form.total_usage_limit}
                      onChange={(e) => setForm({ ...form, total_usage_limit: e.target.value })}
                      placeholder="Unlimited"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Per-Customer Usage Limit</label>
                    <input
                      type="number"
                      value={form.per_customer_usage_limit}
                      onChange={(e) => setForm({ ...form, per_customer_usage_limit: e.target.value })}
                      placeholder="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.first_order_only}
                      onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      disabled={saving}
                    />
                    <span className="text-sm font-medium text-gray-900">First order only</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.allow_stacking}
                      onChange={(e) => setForm({ ...form, allow_stacking: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      disabled={saving}
                    />
                    <span className="text-sm font-medium text-gray-900">Allow stacking with other coupons</span>
                  </label>
                </div>
              </div>

              {/* Applicability */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Applicability</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Applies To</label>
                  <select
                    value={form.applicable_scope}
                    onChange={(e) => setForm({ ...form, applicable_scope: e.target.value as Coupon['applicable_scope'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="entire_store">Entire Store</option>
                    <option value="specific_categories">Specific Categories</option>
                    <option value="specific_products">Specific Products</option>
                    <option value="specific_customers">Specific Customers</option>
                  </select>
                </div>
                {form.applicable_scope === 'specific_categories' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Select Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => toggleCategory(cat.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            form.applicable_categories.includes(cat.value)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {form.applicable_scope === 'specific_products' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">Select Products</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                      {products.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.applicable_product_ids.includes(p.id)}
                            onChange={() => toggleProduct(p.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {form.applicable_scope === 'specific_customers' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      Customer-specific coupons are assigned to users by their ID. Add customer UUIDs
                      in the field below (comma-separated).
                    </p>
                    <input
                      type="text"
                      value={form.applicable_customer_ids.join(', ')}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          applicable_customer_ids: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="user-uuid-1, user-uuid-2"
                      className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Payment Method</h4>
                <select
                  value={form.payment_restriction}
                  onChange={(e) => setForm({ ...form, payment_restriction: e.target.value as Coupon['payment_restriction'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                >
                  <option value="all">All Payment Methods</option>
                  <option value="prepaid">Prepaid / Online Only</option>
                  <option value="cod">COD Only</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Coupon?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete the coupon. If it has redemptions, deletion will be blocked to preserve history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View redemptions modal */}
      {viewingCoupon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Coupon Usage: <span className="font-mono">{viewingCoupon.code}</span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {viewingCoupon.used_count} redemption{viewingCoupon.used_count !== 1 ? 's' : ''}
                  {viewingCoupon.total_usage_limit ? ` / ${viewingCoupon.total_usage_limit} limit` : ''}
                </p>
              </div>
              <button onClick={() => setViewingCoupon(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {loadingRedemptions ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : viewingRedemptions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No redemptions yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Order</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Discount</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewingRedemptions.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono text-gray-700">
                          {r.order?.order_number || '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          ₹{Number(r.discount_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(r.redeemed_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
