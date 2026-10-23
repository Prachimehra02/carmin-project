import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';

interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Collection | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      setCollections(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load collections'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCollections();
  }, [fetchCollections]);

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const openNew = () => {
    setEditing({
      id: 0,
      name: '',
      slug: '',
      description: '',
      active: true,
      created_at: '',
      updated_at: '',
    });

    setIsNew(true);
    setError(null);
    setSuccess('');
  };

  const openEdit = (collection: Collection) => {
    setEditing({ ...collection });
    setIsNew(false);
    setError(null);
    setSuccess('');
  };

  const closeForm = () => {
    setEditing(null);
    setIsNew(false);
  };

  const handleNameChange = (name: string) => {
    setEditing((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        name,
        // Auto-generate slug only while creating
        slug: isNew ? generateSlug(name) : prev.slug,
      };
    });
  };

  const handleSave = async () => {
    if (!editing) return;

    if (!editing.name.trim()) {
      setError('Collection name is required');
      return;
    }

    if (!editing.slug.trim()) {
      setError('Collection slug is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: editing.name.trim(),
        slug: editing.slug.trim().toLowerCase(),
        description: editing.description?.trim() || null,
        active: editing.active,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { error } = await supabase
          .from('collections')
          .insert([payload]);

        if (error) throw error;

        setSuccess('Collection created successfully');
      } else {
        const { error } = await supabase
          .from('collections')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;

        setSuccess('Collection updated successfully');
      }

      await fetchCollections();
      closeForm();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save collection'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection: Collection) => {
    const confirmed = window.confirm(
      `Delete "${collection.name}"? This will remove its product assignments, but it will not delete the products.`
    );

    if (!confirmed) return;

    try {
      setError(null);

      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collection.id);

      if (error) throw error;

      await fetchCollections();

      setSuccess('Collection deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete collection'
      );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Collections
            </h2>

            <p className="text-gray-600 mt-1">
              Manage merchandising groups such as New Arrivals and Gifting
            </p>
          </div>

          {!editing && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Collection
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            {success}
          </div>
        )}

        {editing && (
          <div className="bg-white rounded-lg shadow p-6 border">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold">
                {isNew ? 'Add Collection' : 'Edit Collection'}
              </h3>

              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name
                </label>

                <input
                  value={editing.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. New Arrivals"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Slug
                </label>

                <input
                  value={editing.slug}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      slug: generateSlug(e.target.value),
                    })
                  }
                  placeholder="new-arrivals"
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>

                <textarea
                  value={editing.description || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      active: e.target.checked,
                    })
                  }
                />

                <span className="text-sm">Active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeForm}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Collection'}
              </button>
            </div>
          </div>
        )}

        {!editing && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                Loading collections...
              </div>
            ) : collections.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No collections created yet
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Slug</th>
                    <th className="px-5 py-3 text-left">Description</th>
                    <th className="px-5 py-3 text-center">Active</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {collections.map((collection) => (
                    <tr key={collection.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium">
                        {collection.name}
                      </td>

                      <td className="px-5 py-4 font-mono text-sm">
                        {collection.slug}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {collection.description || '—'}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {collection.active ? 'Yes' : 'No'}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(collection)}
                            className="p-2 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(collection)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}