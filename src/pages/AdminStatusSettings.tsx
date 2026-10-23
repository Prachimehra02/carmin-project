import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Save, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import type { OrderStatusDef, PaymentStatusDef, ReturnStatusDef } from '../types/order';

type StatusType = 'order' | 'payment' | 'return';

const ICON_OPTIONS = [
  'Package', 'CheckCircle2', 'XCircle', 'Clock', 'Truck', 'RotateCcw',
  'AlertCircle', 'ShoppingCart', 'CreditCard', 'Banknote', 'FileText',
];

const COLOR_OPTIONS = [
  { label: 'Yellow', value: 'bg-yellow-100 text-yellow-800' },
  { label: 'Orange', value: 'bg-orange-100 text-orange-800' },
  { label: 'Green', value: 'bg-green-100 text-green-800' },
  { label: 'Blue', value: 'bg-blue-100 text-blue-800' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800' },
  { label: 'Purple', value: 'bg-purple-100 text-purple-800' },
  { label: 'Red', value: 'bg-red-100 text-red-800' },
  { label: 'Gray', value: 'bg-gray-100 text-gray-800' },
  { label: 'Cyan', value: 'bg-cyan-100 text-cyan-800' },
];

export default function AdminStatusSettings() {
  const [activeType, setActiveType] = useState<StatusType>('order');
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusDef[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatusDef[]>([]);
  const [returnStatuses, setReturnStatuses] = useState<ReturnStatusDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oRes, pRes, rRes] = await Promise.all([
        supabase.from('order_statuses').select('*').order('sequence', { ascending: true }),
        supabase.from('payment_statuses').select('*').order('created_at', { ascending: true }),
        supabase.from('return_statuses').select('*').order('sequence', { ascending: true }),
      ]);
      if (oRes.error) throw oRes.error;
      if (pRes.error) throw pRes.error;
      if (rRes.error) throw rRes.error;
      setOrderStatuses(oRes.data || []);
      setPaymentStatuses(pRes.data || []);
      setReturnStatuses(rRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const getCurrentList = () => {
    if (activeType === 'order') return orderStatuses;
    if (activeType === 'payment') return paymentStatuses;
    return returnStatuses;
  };

  const openNew = () => {
    if (activeType === 'order') {
      setEditing({ code: '', name: '', description: '', sequence: orderStatuses.length + 1, color: 'bg-gray-100 text-gray-800', icon: 'Package', show_to_customer: true, allow_customer_cancel: true, is_terminal: false, active: true });
    } else if (activeType === 'payment') {
      setEditing({ code: '', name: '', color: 'bg-gray-100 text-gray-800', active: true });
    } else {
      setEditing({ code: '', name: '', sequence: returnStatuses.length + 1, active: true });
    }
    setIsNew(true);
    setError(null);
    setSuccess('');
  };

  const openEdit = (item: any) => {
    setEditing({ ...item });
    setIsNew(false);
    setError(null);
    setSuccess('');
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const table = activeType === 'order' ? 'order_statuses' : activeType === 'payment' ? 'payment_statuses' : 'return_statuses';
      const payload: any = { ...editing };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (isNew) {
        const { error: insertError } = await supabase.from(table).insert([payload]);
        if (insertError) throw insertError;
        setSuccess('Status created successfully');
      } else {
        const { error: updateError } = await supabase.from(table).update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
        setSuccess('Status updated successfully');
      }
      await fetchAll();
      closeForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this status? Orders using it will keep their current value but lose the reference.')) return;
    const table = activeType === 'order' ? 'order_statuses' : activeType === 'payment' ? 'payment_statuses' : 'return_statuses';
    try {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
      if (deleteError) throw deleteError;
      await fetchAll();
      setSuccess('Status deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete status');
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditing((prev: any) => ({ ...prev, [field]: value }));
  };

  const currentList = getCurrentList();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Status Settings</h2>
          <p className="text-gray-600 mt-1">Manage order, payment, and return statuses</p>
        </div>

        {/* Type tabs */}
        <div className="flex gap-2">
          {(['order', 'payment', 'return'] as StatusType[]).map((type) => (
            <button
              key={type}
              onClick={() => { setActiveType(type); closeForm(); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition ${
                activeType === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type} Statuses
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">{success}</div>
        )}

        {/* Edit/Create form */}
        {editing && (
          <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{isNew ? 'Add New Status' : 'Edit Status'}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Code (machine-readable)</label>
                <input type="text" value={editing.code} onChange={(e) => handleFieldChange('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))} disabled={!isNew} placeholder="e.g. on_hold" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name (display)</label>
                <input type="text" value={editing.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="e.g. On Hold" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>

              {activeType === 'order' && (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                    <input type="text" value={editing.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="Optional description" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Color</label>
                    <select value={editing.color} onChange={(e) => handleFieldChange('color', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium ${editing.color}`}>Preview</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">Icon</label>
                    <select value={editing.icon} onChange={(e) => handleFieldChange('icon', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                    </select>
                  </div>
                </>
              )}

              {activeType !== 'payment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Sequence (sort order)</label>
                  <input type="number" value={editing.sequence} onChange={(e) => handleFieldChange('sequence', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              {activeType === 'payment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Color</label>
                  <select value={editing.color} onChange={(e) => handleFieldChange('color', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-medium ${editing.color}`}>Preview</div>
                </div>
              )}

              {/* Toggles for order statuses */}
              {activeType === 'order' && (
                <div className="sm:col-span-2 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.show_to_customer} onChange={(e) => handleFieldChange('show_to_customer', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700 flex items-center gap-1">{editing.show_to_customer ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} Show to customer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.allow_customer_cancel} onChange={(e) => handleFieldChange('allow_customer_cancel', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Allow customer to cancel order in this status</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.is_terminal} onChange={(e) => handleFieldChange('is_terminal', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Is terminal (final state)</span>
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                <input type="checkbox" checked={editing.active} onChange={(e) => handleFieldChange('active', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Active (available for use)</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeForm} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-medium">
                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Status list */}
        {!editing && (
          <>
            <div className="flex justify-end">
              <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm">
                <Plus className="w-4 h-4" />Add Status
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Code</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      {activeType === 'order' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Color</th>}
                      {activeType === 'order' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Icon</th>}
                      {activeType !== 'payment' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Seq</th>}
                      {activeType === 'order' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Visible</th>}
                      {activeType === 'order' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Cancel</th>}
                      {activeType === 'order' && <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Terminal</th>}
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Active</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentList.map((item: any) => (
                      <tr key={item.id} className={`hover:bg-gray-50 ${!item.active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">{item.code}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                        {activeType === 'order' && (
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${item.color}`}>{item.color.split(' ')[0]}</span>
                          </td>
                        )}
                        {activeType === 'order' && <td className="px-4 py-3 text-sm text-gray-600">{item.icon}</td>}
                        {activeType !== 'payment' && <td className="px-4 py-3 text-sm text-gray-600">{item.sequence}</td>}
                        {activeType === 'order' && <td className="px-4 py-3 text-center">{item.show_to_customer ? <Eye className="w-4 h-4 text-green-600 mx-auto" /> : <EyeOff className="w-4 h-4 text-gray-400 mx-auto" />}</td>}
                        {activeType === 'order' && <td className="px-4 py-3 text-center text-sm">{item.allow_customer_cancel ? 'Yes' : 'No'}</td>}
                        {activeType === 'order' && <td className="px-4 py-3 text-center text-sm">{item.is_terminal ? 'Yes' : 'No'}</td>}
                        <td className="px-4 py-3 text-center text-sm">{item.active ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(item)} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
