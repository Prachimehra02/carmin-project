import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, X, Save, AlertCircle, CheckCircle,
  ChevronDown, ChevronRight, SlidersHorizontal, Loader2,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import {
  type AttributeTypeWithValues, type AttributeType, type AttributeValue,
  generateSlug, fetchAllAttributeTypes,
  createAttributeType, updateAttributeType,
  createAttributeValue, updateAttributeValue,
} from '../services/attributeService';

type TypeFormMode = 'new' | 'edit' | null;
type ValueFormMode = 'new' | 'edit' | null;

interface TypeFormState {
  id?: number;
  name: string;
  slug: string;
  active: boolean;
  slugTouched: boolean;
}

interface ValueFormState {
  id?: number;
  attribute_type_id: number;
  value: string;
  slug: string;
  active: boolean;
  slugTouched: boolean;
}

export default function AdminAttributes() {
  const [types, setTypes] = useState<AttributeTypeWithValues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [typeFormMode, setTypeFormMode] = useState<TypeFormMode>(null);
  const [typeForm, setTypeForm] = useState<TypeFormState | null>(null);
  const [savingType, setSavingType] = useState(false);

  const [valueFormMode, setValueFormMode] = useState<ValueFormMode>(null);
  const [valueForm, setValueForm] = useState<ValueFormState | null>(null);
  const [savingValue, setSavingValue] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllAttributeTypes();
      setTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attribute types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Attribute Type CRUD ───────────────────────────────────

  const openNewType = () => {
    setTypeForm({ name: '', slug: '', active: true, slugTouched: false });
    setTypeFormMode('new');
    setError(null);
  };

  const openEditType = (t: AttributeType) => {
    setTypeForm({ id: t.id, name: t.name, slug: t.slug, active: t.active, slugTouched: true });
    setTypeFormMode('edit');
    setError(null);
  };

  const closeTypeForm = () => {
    setTypeForm(null);
    setTypeFormMode(null);
  };

  const handleTypeFormChange = (field: keyof TypeFormState, value: string | boolean) => {
    setTypeForm((prev) => {
      if (!prev) return prev;
      if (field === 'name' && !prev.slugTouched) {
        return { ...prev, name: value as string, slug: generateSlug(value as string) };
      }
      if (field === 'slug') {
        return { ...prev, slug: value as string, slugTouched: true };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSaveType = async () => {
    if (!typeForm) return;
    if (!typeForm.name.trim()) { setError('Attribute type name is required'); return; }
    if (!typeForm.slug.trim()) { setError('Slug is required'); return; }

    const slug = typeForm.slug.trim();
    const existing = types.find(
      (t) => t.slug === slug && t.id !== typeForm.id
    );
    if (existing) {
      setError(`An attribute type with slug "${slug}" already exists`);
      return;
    }

    setSavingType(true);
    setError(null);
    try {
      if (typeFormMode === 'new') {
        await createAttributeType({ name: typeForm.name.trim(), slug, active: typeForm.active });
        showSuccess('Attribute type created successfully');
      } else if (typeFormMode === 'edit' && typeForm.id) {
        await updateAttributeType(typeForm.id, {
          name: typeForm.name.trim(), slug, active: typeForm.active,
        });
        showSuccess('Attribute type updated successfully');
      }
      closeTypeForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attribute type');
    } finally {
      setSavingType(false);
    }
  };

  const handleToggleTypeActive = async (t: AttributeType) => {
    setError(null);
    try {
      await updateAttributeType(t.id, { active: !t.active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  // ─── Attribute Value CRUD ──────────────────────────────────

  const openNewValue = (typeId: number) => {
    setValueForm({
      attribute_type_id: typeId,
      value: '', slug: '', active: true, slugTouched: false,
    });
    setValueFormMode('new');
    setError(null);
    if (!expandedIds.has(typeId)) toggleExpand(typeId);
  };

  const openEditValue = (v: AttributeValue) => {
    setValueForm({
      id: v.id,
      attribute_type_id: v.attribute_type_id,
      value: v.value,
      slug: v.slug,
      active: v.active,
      slugTouched: true,
    });
    setValueFormMode('edit');
    setError(null);
  };

  const closeValueForm = () => {
    setValueForm(null);
    setValueFormMode(null);
  };

  const handleValueFormChange = (field: keyof ValueFormState, value: string | boolean) => {
    setValueForm((prev) => {
      if (!prev) return prev;
      if (field === 'value' && !prev.slugTouched) {
        return { ...prev, value: value as string, slug: generateSlug(value as string) };
      }
      if (field === 'slug') {
        return { ...prev, slug: value as string, slugTouched: true };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSaveValue = async () => {
    if (!valueForm) return;
    if (!valueForm.value.trim()) { setError('Value is required'); return; }
    if (!valueForm.slug.trim()) { setError('Slug is required'); return; }

    const slug = valueForm.slug.trim();
    const parentType = types.find((t) => t.id === valueForm.attribute_type_id);
    if (parentType) {
      const dup = parentType.attribute_values.find(
        (v) => v.slug === slug && v.id !== valueForm.id
      );
      if (dup) {
        setError(`A value with slug "${slug}" already exists under "${parentType.name}"`);
        return;
      }
      const dupValue = parentType.attribute_values.find(
        (v) => v.value.toLowerCase() === valueForm.value.trim().toLowerCase() &&
              v.id !== valueForm.id
      );
      if (dupValue) {
        setError(`Value "${valueForm.value.trim()}" already exists under "${parentType.name}"`);
        return;
      }
    }

    setSavingValue(true);
    setError(null);
    try {
      if (valueFormMode === 'new') {
        await createAttributeValue({
          attribute_type_id: valueForm.attribute_type_id,
          value: valueForm.value.trim(),
          slug,
          active: valueForm.active,
        });
        showSuccess('Value added successfully');
      } else if (valueFormMode === 'edit' && valueForm.id) {
        await updateAttributeValue(valueForm.id, {
          value: valueForm.value.trim(),
          slug,
          active: valueForm.active,
        });
        showSuccess('Value updated successfully');
      }
      closeValueForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save value');
    } finally {
      setSavingValue(false);
    }
  };

  const handleToggleValueActive = async (v: AttributeValue) => {
    setError(null);
    try {
      await updateAttributeValue(v.id, { active: !v.active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <SlidersHorizontal className="w-8 h-8 text-gray-700" />
              Attributes
            </h2>
            <p className="text-gray-600 mt-1">
              Manage attribute types (e.g. Color, Material) and their values (e.g. Blue, Ceramic)
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Type form (new/edit) */}
        {typeForm && (
          <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {typeFormMode === 'new' ? 'Add Attribute Type' : 'Edit Attribute Type'}
              </h3>
              <button onClick={closeTypeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => handleTypeFormChange('name', e.target.value)}
                  placeholder="e.g. Color"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Slug *</label>
                <input
                  type="text"
                  value={typeForm.slug}
                  onChange={(e) => handleTypeFormChange('slug', e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeForm.active}
                    onChange={(e) => handleTypeFormChange('active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeTypeForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveType}
                disabled={savingType}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-medium"
              >
                {savingType ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingType ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Value form (new/edit) */}
        {valueForm && (
          <div className="bg-white rounded-lg shadow p-6 border-2 border-indigo-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {valueFormMode === 'new' ? 'Add Value' : 'Edit Value'}
              </h3>
              <button onClick={closeValueForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Value *</label>
                <input
                  type="text"
                  value={valueForm.value}
                  onChange={(e) => handleValueFormChange('value', e.target.value)}
                  placeholder="e.g. Blue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Slug *</label>
                <input
                  type="text"
                  value={valueForm.slug}
                  onChange={(e) => handleValueFormChange('slug', e.target.value)}
                  placeholder="auto-generated-from-value"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={valueForm.active}
                    onChange={(e) => handleValueFormChange('active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeValueForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveValue}
                disabled={savingValue}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 font-medium"
              >
                {savingValue ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingValue ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Add button + list */}
        {!typeForm && !valueForm && (
          <>
            <div className="flex justify-end">
              <button
                onClick={openNewType}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Attribute Type
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
              </div>
            ) : types.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                No attribute types yet. Click "Add Attribute Type" to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {types.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-white rounded-lg shadow overflow-hidden ${!t.active ? 'opacity-60' : ''}`}
                  >
                    {/* Type header row */}
                    <div className="flex items-center gap-3 px-4 py-4">
                      <button
                        onClick={() => toggleExpand(t.id)}
                        className="p-1 text-gray-400 hover:text-gray-700 transition"
                      >
                        {expandedIds.has(t.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <span className="font-semibold text-gray-900">{t.name}</span>
                        <span className="ml-2 text-sm text-gray-500 font-mono">{t.slug}</span>
                        <span className="ml-3 text-xs text-gray-400">
                          {t.attribute_values?.length ?? 0} value(s)
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleTypeActive(t)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          t.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => openEditType(t)}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Expanded values */}
                    {expandedIds.has(t.id) && (
                      <div className="border-t bg-gray-50">
                        <div className="px-4 py-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Values</span>
                          <button
                            onClick={() => openNewValue(t.id)}
                            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Value
                          </button>
                        </div>
                        {t.attribute_values && t.attribute_values.length > 0 ? (
                          <table className="w-full">
                            <thead className="border-t bg-white">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Value</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Slug</th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y bg-white">
                              {t.attribute_values.map((v) => (
                                <tr key={v.id} className={v.active ? '' : 'opacity-50'}>
                                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{v.value}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500 font-mono">{v.slug}</td>
                                  <td className="px-4 py-2 text-center">
                                    <button
                                      onClick={() => handleToggleValueActive(v)}
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        v.active
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {v.active ? 'Active' : 'Inactive'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => openEditValue(v)}
                                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="px-4 py-6 text-center text-sm text-gray-400">
                            No values yet. Click "Add Value" to create one.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
