import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, X, Save, AlertCircle, CheckCircle,
  Tags, Search, Loader2, AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import {
  type Tag,
  type DuplicateCheckResult,
  generateSlug, fetchAllTags, createTag, updateTag,
  checkForDuplicates,
} from '../services/tagService';

type FormMode = 'new' | 'edit' | null;

interface TagFormState {
  id?: number;
  name: string;
  slug: string;
  active: boolean;
  slugTouched: boolean;
}

export default function AdminTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [form, setForm] = useState<TagFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTags();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
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

  const openNew = () => {
    setForm({ name: '', slug: '', active: true, slugTouched: false });
    setFormMode('new');
    setError(null);
    setWarning(null);
  };

  const openEdit = (t: Tag) => {
    setForm({ id: t.id, name: t.name, slug: t.slug, active: t.active, slugTouched: true });
    setFormMode('edit');
    setError(null);
    setWarning(null);
  };

  const closeForm = () => {
    setForm(null);
    setFormMode(null);
    setWarning(null);
  };

  const handleFieldChange = (field: keyof TagFormState, value: string | boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      if (field === 'name' && !prev.slugTouched) {
        return { ...prev, name: value as string, slug: generateSlug(value as string) };
      }
      if (field === 'slug') {
        return { ...prev, slug: value as string, slugTouched: true };
      }
      return { ...prev, [field]: value };
    });
    // Clear warning when the admin edits the name or slug
    if (field === 'name' || field === 'slug') {
      setWarning(null);
    }
  };

  /**
   * Validate the form and return the duplicate-check result if validation passes.
   * Returns null if a hard error was set (caller should abort).
   */
  const validateAndCheck: () => DuplicateCheckResult | null = () => {
    if (!form) return null;
    if (!form.name.trim()) { setError('Tag name is required'); return null; }
    if (!form.slug.trim()) { setError('Slug is required'); return null; }

    const name = form.name.trim();
    const slug = form.slug.trim();
    setError(null);

    const check = checkForDuplicates(name, slug, tags, form.id);

    if (check.isExactName) {
      setError(`A tag with name "${name}" already exists`);
      return null;
    }
    if (check.isExactSlug) {
      setError(`A tag with slug "${slug}" already exists`);
      return null;
    }

    return check;
  };

  const handleSave = async () => {
    if (!form) return;
    const check = validateAndCheck();
    if (!check) return;

    const name = form.name.trim();
    const slug = form.slug.trim();

    // If there's a similar tag and the admin hasn't confirmed yet, show warning
    if (check.similarTag && !warning) {
      setWarning(
        `A similar tag already exists: "${check.similarTag.name}". ` +
        'Consider using the existing tag. Save again to proceed anyway.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      if (formMode === 'new') {
        await createTag({ name, slug, active: form.active });
        showSuccess('Tag created successfully');
      } else if (formMode === 'edit' && form.id) {
        await updateTag(form.id, { name, slug, active: form.active });
        showSuccess('Tag updated successfully');
      }
      closeForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: Tag) => {
    setError(null);
    try {
      await updateTag(t.id, { active: !t.active });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Tags className="w-8 h-8 text-gray-700" />
            Tags
          </h2>
          <p className="text-gray-600 mt-1">
            Manage product tags for labeling and discovery
          </p>
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

        {/* Create/Edit form */}
        {form && (
          <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {formMode === 'new' ? 'Add Tag' : 'Edit Tag'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {warning && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-800 text-sm">{warning}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Best Seller"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleFieldChange('slug', e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => handleFieldChange('active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-medium"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : warning ? 'Save Anyway' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Search + Add */}
        {!form && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by tag name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={openNew}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Tag
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                {searchQuery
                  ? 'No tags match your search.'
                  : 'No tags yet. Click "Add Tag" to create one.'}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Slug</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTags.map((t) => (
                        <tr
                          key={t.id}
                          className={`hover:bg-gray-50 ${!t.active ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{t.slug}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(t)}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                t.active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {t.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
