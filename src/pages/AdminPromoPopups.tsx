import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, AlertCircle, X, Power, Image as ImageIcon, Tag,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import { PromoPopup, Coupon } from '../types/order';

const emptyForm = {
  title: '',
  subtitle: '',
  coupon_code: '',
  discount_text: '',
  cta_button_text: 'Shop Now',
  cta_destination: '/products',
  image_url: '',
  background_url: '',
  start_date: '',
  end_date: '',
  active: true,
  display_frequency: 'once_per_session' as PromoPopup['display_frequency'],
  show_again_after_days: 7,
  target_audience: 'all' as PromoPopup['target_audience'],
  minimum_order_value: 0,
  trigger_type: 'time_delay' as PromoPopup['trigger_type'],
  desktop_delay_seconds: 5,
  mobile_delay_seconds: 8,
  scroll_percentage: 50,
};

export default function AdminPromoPopups() {
  const [popups, setPopups] = useState<PromoPopup[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchPopups();
    fetchCoupons();
  }, []);

  const fetchPopups = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('promo_popups')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setPopups((data || []) as PromoPopup[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch popups');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const { data, error: err } = await supabase
        .from('coupons')
        .select('id, code, name, type, value, active, first_order_only, expiry_date, minimum_order_amount')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setCoupons((data || []) as Coupon[]);
    } catch {
      // non-fatal — admin can still type manually as fallback
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (popup: PromoPopup) => {
    setEditingId(popup.id);
    setForm({
      title: popup.title,
      subtitle: popup.subtitle || '',
      coupon_code: popup.coupon_code || '',
      discount_text: popup.discount_text || '',
      cta_button_text: popup.cta_button_text,
      cta_destination: popup.cta_destination,
      image_url: popup.image_url || '',
      background_url: popup.background_url || '',
      start_date: popup.start_date ? new Date(popup.start_date).toISOString().slice(0, 16) : '',
      end_date: popup.end_date ? new Date(popup.end_date).toISOString().slice(0, 16) : '',
      active: popup.active,
      display_frequency: popup.display_frequency,
      show_again_after_days: popup.show_again_after_days,
      target_audience: popup.target_audience,
      minimum_order_value: popup.minimum_order_value,
      trigger_type: popup.trigger_type,
      desktop_delay_seconds: popup.desktop_delay_seconds,
      mobile_delay_seconds: popup.mobile_delay_seconds,
      scroll_percentage: popup.scroll_percentage,
    });
    setShowForm(true);
  };

  // When a coupon is selected from the dropdown, auto-fill discount text if empty
  const handleCouponSelect = (code: string) => {
    setForm((prev) => {
      const coupon = coupons.find((c) => c.code === code);
      const autoDiscountText = coupon
        ? coupon.type === 'percentage'
          ? `${coupon.value}% OFF`
          : `₹${coupon.value} OFF`
        : '';
      return {
        ...prev,
        coupon_code: code,
        // Only auto-fill if discount_text is empty or was previously auto-generated
        discount_text: prev.discount_text || autoDiscountText,
        // Auto-set target audience to new_customers_only for first-order coupons
        target_audience: coupon?.first_order_only ? 'new_customers_only' : prev.target_audience,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('Title is required'); return; }

    try {
      setSaving(true);
      const data: Record<string, unknown> = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        coupon_code: form.coupon_code.trim().toUpperCase() || null,
        discount_text: form.discount_text.trim() || null,
        cta_button_text: form.cta_button_text || 'Shop Now',
        cta_destination: form.cta_destination || '/products',
        image_url: form.image_url.trim() || null,
        background_url: form.background_url.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        active: form.active,
        display_frequency: form.display_frequency,
        show_again_after_days: form.show_again_after_days,
        target_audience: form.target_audience,
        minimum_order_value: Number(form.minimum_order_value) || 0,
        trigger_type: form.trigger_type,
        desktop_delay_seconds: Number(form.desktop_delay_seconds) || 0,
        mobile_delay_seconds: Number(form.mobile_delay_seconds) || 0,
        scroll_percentage: Number(form.scroll_percentage) || 50,
      };

      if (editingId) {
        const { error: err } = await supabase.from('promo_popups').update(data).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('promo_popups').insert([data]);
        if (err) throw err;
      }

      setShowForm(false);
      fetchPopups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save popup');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (popup: PromoPopup) => {
    try {
      const { error: err } = await supabase
        .from('promo_popups')
        .update({ active: !popup.active })
        .eq('id', popup.id);
      if (err) throw err;
      fetchPopups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update popup');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error: err } = await supabase.from('promo_popups').delete().eq('id', id);
      if (err) throw err;
      setPopups(popups.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete popup');
    }
  };

  const isCurrentlyActive = (p: PromoPopup) => {
    if (!p.active) return false;
    const now = new Date();
    if (p.start_date && new Date(p.start_date) > now) return false;
    if (p.end_date && new Date(p.end_date) < now) return false;
    return true;
  };

  const getCouponForPopup = (p: PromoPopup) =>
    coupons.find((c) => c.code.toUpperCase() === (p.coupon_code || '').toUpperCase());

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Promotional Popups</h2>
            <p className="text-gray-600 mt-1">Configure promotional popups and first-purchase offers</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Create Popup
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        )}

        {!loading && !showForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popups.length === 0 ? (
              <div className="col-span-2 bg-white rounded-lg shadow p-12 text-center">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No popups configured</p>
                <p className="text-gray-400 text-sm mt-1">Create a promotional popup to engage visitors</p>
              </div>
            ) : (
              popups.map((popup) => {
                const linkedCoupon = getCouponForPopup(popup);
                return (
                  <div key={popup.id} className="bg-white rounded-lg shadow p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{popup.title}</h3>
                        {popup.subtitle && <p className="text-sm text-gray-600 mt-1">{popup.subtitle}</p>}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          isCurrentlyActive(popup)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {isCurrentlyActive(popup) ? 'Live' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {popup.coupon_code && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-mono font-semibold text-gray-900">{popup.coupon_code}</span>
                          {linkedCoupon?.first_order_only && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">First order</span>
                          )}
                        </div>
                      )}
                      {popup.discount_text && <p>Discount: {popup.discount_text}</p>}
                      <p>Frequency: <span className="capitalize">{popup.display_frequency.replace(/_/g, ' ')}</span></p>
                      <p>Target: <span className="capitalize">{popup.target_audience.replace(/_/g, ' ')}</span></p>
                      <p>Trigger: <span className="capitalize">{
                        popup.trigger_type === 'time_delay'
                          ? `After ${popup.desktop_delay_seconds}s (desktop) / ${popup.mobile_delay_seconds}s (mobile)`
                          : popup.trigger_type === 'exit_intent'
                          ? 'Exit intent'
                          : `Scroll ${popup.scroll_percentage}%`
                      }</span></p>
                      {popup.start_date && <p>Start: {new Date(popup.start_date).toLocaleDateString()}</p>}
                      {popup.end_date && <p>End: {new Date(popup.end_date).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <button
                        onClick={() => handleToggle(popup)}
                        className={`p-2 rounded-lg transition ${
                          popup.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={popup.active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openEdit(popup)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(popup.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!loading && showForm && (
          <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Popup' : 'Create Popup'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Popup Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Welcome to Carmin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Subtitle / Message</label>
                <textarea
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g., Get Flat 10% OFF on your first purchase"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  disabled={saving}
                />
              </div>

              {/* Coupon selector */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Promoted Coupon
                </label>
                {coupons.length > 0 ? (
                  <select
                    value={form.coupon_code}
                    onChange={(e) => handleCouponSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="">No coupon (text-only popup)</option>
                    {coupons.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code}
                        {c.name ? ` — ${c.name}` : ''}
                        {c.first_order_only ? ' (first order only)' : ''}
                        {!c.active ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.coupon_code}
                    onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                    placeholder="Enter coupon code"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    disabled={saving}
                  />
                )}
                {form.coupon_code && (() => {
                  const selected = coupons.find((c) => c.code === form.coupon_code);
                  if (!selected) return null;
                  return (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {selected.first_order_only && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                          First order only — popup will only show to customers without completed orders
                        </span>
                      )}
                      {selected.type === 'percentage' ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {selected.value}% off
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          ₹{selected.value} off
                        </span>
                      )}
                      {selected.minimum_order_amount > 0 && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Min ₹{selected.minimum_order_amount}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Discount Text (override)</label>
                <input
                  type="text"
                  value={form.discount_text}
                  onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
                  placeholder="e.g., Flat 10% OFF (leave empty to auto-generate from coupon)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={form.cta_button_text}
                    onChange={(e) => setForm({ ...form, cta_button_text: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">CTA Destination</label>
                  <input
                    type="text"
                    value={form.cta_destination}
                    onChange={(e) => setForm({ ...form, cta_destination: e.target.value })}
                    placeholder="/products"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
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
                  <label className="block text-sm font-medium text-gray-900 mb-1">End Date</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Display Frequency</label>
                  <select
                    value={form.display_frequency}
                    onChange={(e) => setForm({ ...form, display_frequency: e.target.value as PromoPopup['display_frequency'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="once_per_session">Once per session</option>
                    <option value="once_per_day">Once per day</option>
                    <option value="once_until_dismissed">Once until dismissed</option>
                    <option value="show_again_after_days">Show again after X days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Target Audience</label>
                  <select
                    value={form.target_audience}
                    onChange={(e) => setForm({ ...form, target_audience: e.target.value as PromoPopup['target_audience'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="all">All customers</option>
                    <option value="first_time_visitors">First-time visitors only</option>
                    <option value="logged_out_only">Logged-out visitors only</option>
                    <option value="new_customers_only">New customers only (no completed orders)</option>
                  </select>
                </div>
              </div>
              {form.display_frequency === 'show_again_after_days' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Show Again After (days)</label>
                  <input
                    type="number"
                    value={form.show_again_after_days}
                    onChange={(e) => setForm({ ...form, show_again_after_days: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
              )}

              {/* ── Trigger Configuration ── */}
              <div className="border-t border-gray-200 pt-5">
                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Display Trigger</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-900 mb-1">Trigger Type</label>
                  <select
                    value={form.trigger_type}
                    onChange={(e) => setForm({ ...form, trigger_type: e.target.value as PromoPopup['trigger_type'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="time_delay">Time Delay (show after N seconds)</option>
                    <option value="exit_intent">Exit Intent (show when mouse leaves)</option>
                    <option value="scroll_percentage">Scroll Percentage (show after scrolling X%)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {form.trigger_type === 'time_delay' && 'Popup appears after the configured delay. You can set different delays for desktop and mobile.'}
                    {form.trigger_type === 'exit_intent' && 'On desktop, the popup appears when the mouse moves toward the top of the browser (about to close/switch tabs). On mobile, it falls back to the mobile delay setting.'}
                    {form.trigger_type === 'scroll_percentage' && 'Popup appears after the visitor scrolls past the specified percentage of the page.'}
                  </p>
                </div>
                {form.trigger_type === 'time_delay' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Desktop Delay (seconds)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.desktop_delay_seconds}
                        onChange={(e) => setForm({ ...form, desktop_delay_seconds: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Mobile Delay (seconds)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.mobile_delay_seconds}
                        onChange={(e) => setForm({ ...form, mobile_delay_seconds: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={saving}
                      />
                    </div>
                  </div>
                )}
                {form.trigger_type === 'exit_intent' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Mobile Fallback Delay (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.mobile_delay_seconds}
                      onChange={(e) => setForm({ ...form, mobile_delay_seconds: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Used on mobile devices where exit intent detection is not possible. The desktop delay is not used for this trigger type.
                    </p>
                  </div>
                )}
                {form.trigger_type === 'scroll_percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Scroll Percentage (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.scroll_percentage}
                      onChange={(e) => setForm({ ...form, scroll_percentage: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Popup appears after the visitor scrolls past this percentage of the total page height (1–100).
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Image URL (optional)</label>
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Background URL (optional)</label>
                  <input
                    type="text"
                    value={form.background_url}
                    onChange={(e) => setForm({ ...form, background_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Minimum Order Value (₹)</label>
                <input
                  type="number"
                  value={form.minimum_order_value}
                  onChange={(e) => setForm({ ...form, minimum_order_value: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                />
                <p className="text-xs text-gray-400 mt-1">
                  If a coupon is selected, its own minimum order amount will also apply at checkout.
                </p>
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
                  {saving ? 'Saving...' : editingId ? 'Update Popup' : 'Create Popup'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
