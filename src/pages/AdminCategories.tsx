import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Save, AlertCircle, FolderTree, ChevronRight, ChevronDown } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';

interface Category {
  id: number;
  name: string;
  slug: string;
  sku_prefix: string;
  parent_id: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  children?: Category[];
  image_url: string | null;
  description: string | null;
  menu_order: number;
}

interface CategoryForm {
  id?: number;
  name: string;
  slug: string;
  sku_prefix: string;
  parent_id: number | null;
  active: boolean;
  image_url: string | null;
  description: string | null;
  menu_order: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildTree(categories: Category[], parentId: number | null = null): Category[] {
  return categories
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) =>
    (a.menu_order ?? 0) - (b.menu_order ?? 0) ||
    a.name.localeCompare(b.name)
)
    .map((c) => ({ ...c, children: buildTree(categories, c.id) }));
}

function countDescendants(categories: Category[], parentId: number): number {
  const children = categories.filter((c) => c.parent_id === parentId);
  return children.reduce((sum, c) => sum + 1 + countDescendants(categories, c.id), 0);
}

function TreeNode({
  category,
  depth,
  allCategories,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: Category;
  depth: number;
  allCategories: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleActive: (cat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;
  const childCount = hasChildren ? countDescendants(allCategories, category.id) : 0;

  return (
    <>
      <tr className={`hover:bg-gray-50 ${!category.active ? 'opacity-50' : ''}`}>
        <td className="px-4 py-3">
          <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mr-2 text-gray-400 hover:text-gray-700 flex-shrink-0"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="mr-2 ml-4 text-gray-300 flex-shrink-0">└</span>
            )}
            <span className="text-sm font-medium text-gray-900">{category.name}</span>
            {childCount > 0 && (
              <span className="ml-2 text-xs text-gray-400">({childCount} sub{childCount > 1 ? 's' : ''})</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 font-mono text-sm text-gray-700">{category.sku_prefix}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{category.slug}</td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => onToggleActive(category)}
            className={`px-2 py-1 rounded text-xs font-medium ${category.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}
          >
            {category.active ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button onClick={() => onEdit(category)} className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDelete(category)} className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>
      {expanded && hasChildren &&
        category.children!.map((child) => (
          <TreeNode
            key={child.id}
            category={child}
            depth={depth + 1}
            allCategories={allCategories}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        ))}
    </>
  );
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const [editing, setEditing] = useState<CategoryForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaImages, setMediaImages] = useState<
  { id: string; file_name: string; public_url: string }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const tree = buildTree(categories);

  const clearImagePreview = () => {
  if (imagePreview?.startsWith("blob:")) {
    URL.revokeObjectURL(imagePreview);
  }};

  const openNew = (parentId: number | null = null) => {
    clearImagePreview();
    setSelectedImage(null);
    setImagePreview(null);
    setEditing({
      name: '',
      slug: '',
      sku_prefix: '',
      parent_id: parentId,
      active: true,
      image_url: null,
      description: null,
      menu_order: 0,
    });
    setIsNew(true);
    setError(null);
    setSuccess('');
  };

  const openEdit = (cat: Category) => {
    clearImagePreview();
    setSelectedImage(null);
    setImagePreview(cat.image_url);
    setEditing({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      sku_prefix: cat.sku_prefix,
      parent_id: cat.parent_id,
      active: cat.active,
      image_url: cat.image_url,
      description: cat.description,
      menu_order: cat.menu_order ?? 0,
    });
    setIsNew(false);
    setError(null);
    setSuccess('');
  };

  const closeForm = () => {
    clearImagePreview();
    setSelectedImage(null);
    setImagePreview(null);
    setEditing(null);
    setIsNew(false);
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (field === 'name' && isNew) {
        updated.slug = slugify(value);
      }
      return updated;
    });
  };

  const handleImageChange = (file: File | null) => {
  if (imagePreview?.startsWith("blob:")) {
    URL.revokeObjectURL(imagePreview);
  }

  if (!file) {
    setSelectedImage(null);
    setImagePreview(editing?.image_url ?? null);
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    setError("Only JPG, PNG, and WebP images are allowed.");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setError("Image must be smaller than 2 MB.");
    return;
  }

  setSelectedImage(file);
  setImagePreview(URL.createObjectURL(file));
  setError(null);
};

  const handleRemoveImage = () => {
  clearImagePreview();

  setSelectedImage(null);
  setImagePreview(null);

  setEditing((prev) =>
    prev ? { ...prev, image_url: null } : prev
  );

  setError(null);
};

  const openMediaPicker = async () => {
  setLoadingMedia(true);
  setError(null);
  setShowMediaPicker(true);

  const { data, error: mediaError } = await supabase
    .from("media_assets")
    .select("id, file_name, public_url")
    .order("created_at", { ascending: false });

  if (mediaError) {
    setError(mediaError.message);
    setShowMediaPicker(false);
  } else {
    setMediaImages(data ?? []);
  }

  setLoadingMedia(false);
};

const selectMediaImage = (url: string) => {
  clearImagePreview();
  setSelectedImage(null);
  setImagePreview(url);

  setEditing((prev) =>
    prev ? { ...prev, image_url: url } : prev
  );

  setShowMediaPicker(false);
};

  const uploadCategoryImage = async (file: File): Promise<string> => {
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
      ? "png"
      : "webp";

  const filePath = `${crypto.randomUUID()}.${extension}`;
  const bucket = "category-images";

  // 1. Upload image to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  // 2. Get public image URL
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  // 3. Register image in the central Media Library
  const { error: mediaError } = await supabase
    .from("media_assets")
    .insert({
      file_name: file.name,
      storage_bucket: bucket,
      storage_path: filePath,
      public_url: data.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      folder_id: null,
    });

  // 4. Clean up Storage if registration fails
  if (mediaError) {
    const { error: cleanupError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (cleanupError) {
      throw new Error(
        `Media registration failed: ${mediaError.message}. ` +
        `Storage cleanup also failed: ${cleanupError.message}`
      );
    }

    throw mediaError;
  }

  return data.publicUrl;
};
  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError('Category name is required');
      return;
    }
    if (!editing.sku_prefix.trim()) {
      setError('SKU prefix is required');
      return;
    }
    if (!editing.slug.trim()) {
      setEditing((prev) => prev ? { ...prev, slug: slugify(editing.name) } : prev);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let finalImageUrl = editing.image_url;
      
      if (selectedImage) {
        finalImageUrl = await uploadCategoryImage(selectedImage);
        }
      const payload = {
        name: editing.name.trim(),
        slug: editing.slug.trim(),
        sku_prefix: editing.sku_prefix.trim().toUpperCase(),
        parent_id: editing.parent_id,
        active: editing.active,
        image_url: finalImageUrl,
        description: editing.description?.trim() || null,
        menu_order: editing.menu_order,
      };

      if (isNew) {
        const { error: insertError } = await supabase.from('categories').insert([payload]);
        if (insertError) throw insertError;
        setSuccess('Category created successfully');
      } else {
        const { error: updateError } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editing.id);
        if (updateError) throw updateError;
        setSuccess('Category updated successfully');
      }
      await fetchCategories();
      closeForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    const childCount = countDescendants(categories, cat.id);
    const msg = childCount > 0
      ? `Are you sure you want to delete "${cat.name}"? It has ${childCount} sub-categor${childCount > 1 ? 'ies' : 'y'} that will be detached (set to main categories).`
      : `Are you sure you want to delete "${cat.name}"?`;

    if (!confirm(msg)) return;
    try {
      const { error: deleteError } = await supabase.from('categories').delete().eq('id', cat.id);
      if (deleteError) throw deleteError;
      await fetchCategories();
      setSuccess('Category deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ active: !cat.active })
        .eq('id', cat.id);
      if (updateError) throw updateError;
      await fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  const parentOptions = categories.filter((c) => c.id !== editing?.id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Categories</h2>
          <p className="text-gray-600 mt-1">Manage product categories and sub-categories</p>
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
              <h3 className="text-lg font-bold text-gray-900">
                {isNew ? 'Add Category' : 'Edit Category'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g. Home Decor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">SKU Prefix *</label>
                <input
                  type="text"
                  value={editing.sku_prefix}
                  onChange={(e) => handleFieldChange('sku_prefix', e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="e.g. HDR"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                />
                <p className="mt-1 text-xs text-gray-500">Short code (max 5 chars) used as a prefix for product SKUs</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Slug</label>
                <input
                  type="text"
                  value={editing.slug}
                  onChange={(e) => handleFieldChange('slug', slugify(e.target.value))}
                  placeholder="auto-generated from name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">URL-friendly identifier, auto-generated from name</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Parent Category</label>
                <select
                  value={editing.parent_id ?? ''}
                  onChange={(e) => handleFieldChange('parent_id', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">None (Main Category)</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} [{c.sku_prefix}]
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {editing.parent_id ? 'Will be created as a sub-category' : 'Will be created as a main category'}
                </p>
              </div>

              <div className="sm:col-span-2">
  <label className="block text-sm font-medium text-gray-900 mb-2">
    Category Image
  </label>

  {/* Image preview */}
  {imagePreview ? (
    <div className="mb-4">
      <img
        src={imagePreview}
        alt="Category preview"
        className="w-48 h-36 object-cover rounded-lg border border-gray-200"
      />
    </div>
  ) : (
    <div className="mb-4 w-48 h-36 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center justify-center text-gray-400">
      <span className="text-sm">No image selected</span>
    </div>
  )}

  {/* Image actions */}
  <div className="flex flex-wrap items-center gap-3">

    {/* Media Library */}
    <button
      type="button"
      onClick={() => void openMediaPicker()}
      className="px-4 py-2 border border-[#960018] text-[#960018] rounded-lg hover:bg-[#960018]/5 text-sm font-medium transition"
    >
      Choose from Media Library
    </button>

    {/* Upload image */}
    <label className="cursor-pointer px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition">
      Upload New Image

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          handleImageChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
        className="hidden"
      />
    </label>

    {/* Remove image */}
    {imagePreview && (
      <button
        type="button"
        onClick={handleRemoveImage}
        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
      >
        <Trash2 className="w-4 h-4" />
        Remove Image
      </button>
    )}
  </div>

  <p className="mt-3 text-xs text-gray-500">
    JPG, PNG or WebP. Maximum 2 MB.
    Recommended: landscape image.
  </p>
</div>

<div className="sm:col-span-2">
  <label className="block text-sm font-medium text-gray-900 mb-1">
    Description
  </label>

  <textarea
    value={editing.description ?? ""}
    onChange={(e) => handleFieldChange("description", e.target.value)}
    rows={3}
    placeholder="Short description for the category mega menu"
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
  />
</div>

<div>
  <label className="block text-sm font-medium text-gray-900 mb-1">
    Menu Order
  </label>

  <input
    type="number"
    min={0}
    value={editing.menu_order}
    onChange={(e) =>
      handleFieldChange("menu_order", Number(e.target.value))
    }
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
  />

  <p className="mt-1 text-xs text-gray-500">
    Lower numbers appear first.
  </p>
</div>
              
              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-8">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => handleFieldChange('active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeForm} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-medium">
                <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Tree view */}
        {!editing && (
          <>
            <div className="flex justify-end">
              <button onClick={() => openNew()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm">
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
              </div>
            ) : tree.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <FolderTree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No categories yet</p>
                <button onClick={() => openNew()} className="inline-flex items-center gap-2 text-blue-600 font-medium text-sm">
                  <Plus className="w-4 h-4" /> Create your first category
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">SKU Prefix</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Slug</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tree.map((cat) => (
                        <TreeNode
                          key={cat.id}
                          category={cat}
                          depth={0}
                          allCategories={categories}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                          onToggleActive={handleToggleActive}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {showMediaPicker && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-[#2B1F3D]">
          Choose from Media Library
        </h2>

        <button
          type="button"
          onClick={() => setShowMediaPicker(false)}
          className="text-gray-500 hover:text-gray-900"
        >
          <X size={20} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loadingMedia ? (
          <p className="text-gray-500">Loading images...</p>
        ) : mediaImages.length === 0 ? (
          <p className="text-gray-500">No images available.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {mediaImages.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => selectMediaImage(image.public_url)}
                className="border border-gray-200 rounded-lg overflow-hidden text-left hover:border-[#960018] hover:shadow-sm transition"
              >
                <img
                  src={image.public_url}
                  alt={image.file_name}
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <p className="text-xs text-gray-600 p-2 truncate">
                  {image.file_name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}
    </AdminLayout>
  );
}
