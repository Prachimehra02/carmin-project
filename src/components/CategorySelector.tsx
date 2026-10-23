import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  sku_prefix: string;
  parent_id: number | null;
  active: boolean;
}

interface CategorySelectorProps {
  value: number | null;
  onChange: (categoryId: number | null) => void;
  disabled?: boolean;
}

export function CategorySelector({ value, onChange, disabled }: CategorySelectorProps) {
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, sku_prefix, parent_id, active')
      .order('name');
    if (!error && data) {
      setAllCategories(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // When value changes (e.g., loading an existing product), resolve the full path
  useEffect(() => {
    if (!value || allCategories.length === 0) {
      setSelectedPath([]);
      return;
    }
    resolvePath(value).then(setSelectedPath);
  }, [value, allCategories]);

  const resolvePath = async (categoryId: number): Promise<number[]> => {
    const { data } = await supabase.rpc('get_category_path', { p_category_id: categoryId });
    if (!data || !Array.isArray(data)) return [];
    return data.map((c: any) => c.id);
  };

  const getChildren = (parentId: number | null): CategoryNode[] => {
    return allCategories
      .filter((c) => c.parent_id === parentId && c.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleSelect = (level: number, categoryId: string) => {
    if (!categoryId) {
      // Clearing this level and below
      const newPath = selectedPath.slice(0, level);
      setSelectedPath(newPath);
      onChange(newPath.length > 0 ? newPath[newPath.length - 1] : null);
    } else {
      const id = Number(categoryId);
      const newPath = [...selectedPath.slice(0, level), id];
      setSelectedPath(newPath);
      onChange(id);
    }
  };

  // Build dropdown levels from the selected path
  const levels: { parentId: number | null; options: CategoryNode[] }[] = [];
  levels.push({ parentId: null, options: getChildren(null) });

  for (let i = 0; i < selectedPath.length; i++) {
    const children = getChildren(selectedPath[i]);
    if (children.length > 0) {
      levels.push({ parentId: selectedPath[i], options: children });
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {levels.map((level, idx) => (
        <div key={idx}>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            {idx === 0 ? 'Main Category *' : `Sub-category ${idx === 1 ? '' : idx}`}
          </label>
          <select
            value={selectedPath[idx] ?? ''}
            onChange={(e) => handleSelect(idx, e.target.value)}
            disabled={disabled}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100"
          >
            <option value="">
              {idx === 0 ? 'Select main category' : 'Select sub-category (optional)'}
            </option>
            {level.options.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} [{cat.sku_prefix}]
              </option>
            ))}
          </select>
        </div>
      ))}
      {levels.length === 0 && (
        <p className="text-sm text-gray-500">No categories available. Create categories first.</p>
      )}
    </div>
  );
}
