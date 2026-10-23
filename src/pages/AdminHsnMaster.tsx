import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Save, AlertCircle, Search } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import type { HsnMaster } from '../types/product';

export default function AdminHsnMaster() {
  const [hsnList, setHsnList] = useState<HsnMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [editing, setEditing] = useState<Partial<HsnMaster> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchHsn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('hsn_master')
        .select('*')
        .order('hsn_code', { ascending: true });
      if (fetchError) throw fetchError;
      setHsnList(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HSN master');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHsn();
  }, [fetchHsn]);

  const openNew = () => {
    setEditing({
      hsn_code: '',
      description: '',
      gst_percentage: 0,
      cgst_percentage: 0,
      sgst_percentage: 0,
      igst_percentage: 0,
      cess_percentage: 0,
      is_active: true,
    });
    setIsNew(true);
    setError(null);
    setSuccess('');
  };

  const openEdit = (item: HsnMaster) => {
    setEditing({ ...item });
    setIsNew(false);
    setError(null);
    setSuccess('');
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.hsn_code || !editing.description) {
      setError('HSN code and description are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = { ...editing };
      if (isNew) {
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        const { error: insertError } = await supabase.from('hsn_master').insert([payload]);
        if (insertError) throw insertError;
        setSuccess('HSN code created successfully');
      } else {
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        const { error: updateError } = await supabase.from('hsn_master').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
        setSuccess('HSN code updated successfully');
      }
      await fetchHsn();
      closeForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save HSN code');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this HSN code? Products using it will lose their HSN reference.')) return;
    try {
      const { error: deleteError } = await supabase.from('hsn_master').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await fetchHsn();
      setSuccess('HSN code deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete HSN code');
    }
  };

  const handleToggleActive = async (item: HsnMaster) => {
    try {
      const { error: updateError } = await supabase
        .from('hsn_master')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);
      if (updateError) throw updateError;
      await fetchHsn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  const filteredList = hsnList.filter((h) =>
    h.hsn_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">HSN Master</h2>
          <p className="text-gray-600 mt-1">Manage HSN codes and GST rates</p>
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
              <h3 className="text-lg font-bold text-gray-900">{isNew ? 'Add HSN Code' : 'Edit HSN Code'}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">HSN Code *</label>
                <input
                  type="text"
                  value={editing.hsn_code || ''}
                  onChange={(e) => handleFieldChange('hsn_code', e.target.value)}
                  disabled={!isNew}
                  placeholder="e.g. 69139090"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description *</label>
                <input
                  type="text"
                  value={editing.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="e.g. Ceramic decorative articles"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">GST %</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.gst_percentage ?? 0}
                  onChange={(e) => handleFieldChange('gst_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Cess %</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.cess_percentage ?? 0}
                  onChange={(e) => handleFieldChange('cess_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">CGST %</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.cgst_percentage ?? 0}
                  onChange={(e) => handleFieldChange('cgst_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">SGST %</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.sgst_percentage ?? 0}
                  onChange={(e) => handleFieldChange('sgst_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">IGST %</label>
                <input
                  type="number"
                  step="0.01"
                  value={editing.igst_percentage ?? 0}
                  onChange={(e) => handleFieldChange('igst_percentage', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-8">
                  <input
                    type="checkbox"
                    checked={editing.is_active ?? true}
                    onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeForm} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-medium">
                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Search + Add */}
        {!editing && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by HSN code or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add HSN Code
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">HSN Code</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">GST %</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">CGST %</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">SGST %</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">IGST %</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Cess %</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredList.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 ${!item.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{item.hsn_code}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900 font-medium">{item.gst_percentage}%</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{item.cgst_percentage}%</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{item.sgst_percentage}%</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{item.igst_percentage}%</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{item.cess_percentage}%</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`px-2 py-1 rounded text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
                            >
                              {item.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
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
                {filteredList.length === 0 && (
                  <div className="p-12 text-center text-gray-500">No HSN codes found</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
