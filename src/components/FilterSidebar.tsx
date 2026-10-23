
import { X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface FilterOptions {
  categoryId?: number;
  collectionIds?: number[];
  attributes?: Record<number, number[]>;
}

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
}

interface Collection {
  id: number;
  name: string;
}

interface AttributeValue {
  id: number;
  value: string;
  active: boolean;
}

interface AttributeType {
  id: number;
  name: string;
  active: boolean;
  attribute_values: AttributeValue[];
}

export default function FilterSidebar({
  isOpen,
  onClose,
  onApply,
  currentFilters,
}: FilterSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [attributeTypes, setAttributeTypes] = useState<AttributeType[]>([]);

  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [attributes, setAttributes] = useState<Record<number, number[]>>({});

  const [homeDecorId, setHomeDecorId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  const [expanded, setExpanded] = useState<string[]>([
    // 'categories',
    'collections',
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setCategoryId(currentFilters.categoryId);
    setCollectionIds(currentFilters.collectionIds || []);
    setAttributes(currentFilters.attributes || {});
  }, [isOpen, currentFilters]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadFilters() {
      try {
        setLoading(true);
        setError(null);

        const [categoryResult, collectionResult, attributeResult] =
          await Promise.all([
            supabase
              .from('categories')
              .select('id, name, parent_id')
              .eq('active', true)
              .order('name'),

            supabase
              .from('collections')
              .select('id, name')
              .eq('active', true)
              .order('name'),

            supabase
              .from('attribute_types')
              .select(`
                id,
                name,
                active,
                attribute_values (
                  id,
                  value,
                  active
                )
              `)
              .eq('active', true)
              .order('name'),
          ]);

        if (categoryResult.error) throw categoryResult.error;
        if (collectionResult.error) throw collectionResult.error;
        if (attributeResult.error) throw attributeResult.error;

        if (cancelled) return;

        const loadedCategories = categoryResult.data || [];

setCategories(loadedCategories);

const homeDecor = loadedCategories.find(
  category =>
    category.name.trim().toLowerCase() === 'home decor'
);

setHomeDecorId(homeDecor?.id ?? null);

setCollections(collectionResult.data || []);

        setAttributeTypes(
          (attributeResult.data || []).map(type => ({
            ...type,
            attribute_values: (type.attribute_values || [])
              .filter(value => value.active)
              .sort((a, b) => a.value.localeCompare(b.value)),
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load filters'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFilters();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const toggleExpanded = (key: string) => {
    setExpanded(prev =>
      prev.includes(key)
        ? prev.filter(item => item !== key)
        : [...prev, key]
    );
  };

  const toggleCollection = (id: number) => {
    setCollectionIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleAttribute = (typeId: number, valueId: number) => {
    setAttributes(prev => {
      const current = prev[typeId] || [];

      const updated = current.includes(valueId)
        ? current.filter(id => id !== valueId)
        : [...current, valueId];

      const next = { ...prev };

      if (updated.length) {
        next[typeId] = updated;
      } else {
        delete next[typeId];
      }

      return next;
    });
  };

  const handleApply = () => {
    const nextFilters: FilterOptions = {};

    if (collectionIds.length) {
      nextFilters.collectionIds = collectionIds;
    }

    if (Object.keys(attributes).length) {
      nextFilters.attributes = attributes;
    }

    onApply(nextFilters);
    onClose();
  };

  const handleReset = () => {
    setCategoryId(undefined);
    setCollectionIds([]);
    setAttributes({});
    onApply({});
    onClose();
  };

  if (!isOpen) return null;

  const sectionHeader = (key: string, title: string) => (
    <button
      type="button"
      onClick={() => toggleExpanded(key)}
      className="w-full flex items-center justify-between py-4 text-left"
    >
      <span className="text-sm font-semibold text-[#2B1F3D]">
        {title}
      </span>

      {expanded.includes(key) ? (
        <ChevronUp className="w-4 h-4 text-[#2B1F3D]" />
      ) : (
        <ChevronDown className="w-4 h-4 text-[#2B1F3D]" />
      )}
    </button>
  );

  
const toggleCategoryExpanded = (id: number) => {
  setExpandedCategories(prev =>
    prev.includes(id)
      ? prev.filter(item => item !== id)
      : [...prev, id]
  );
};

const renderCategory = (category: Category, depth = 0): React.ReactNode => {
  const children = categories.filter(
    item => item.parent_id === category.id
  );

  const isSelected = categoryId === category.id;
  const isExpanded = expandedCategories.includes(category.id);

  return (
    <div key={category.id}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCategoryId(category.id)}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          className={`flex-1 flex items-center justify-between text-left py-3 pr-3 rounded-md transition ${
            isSelected
              ? 'bg-[#960018]/5 text-[#960018] font-medium'
              : 'text-[#2B1F3D] hover:bg-gray-50'
          }`}
        >
          <span className={depth > 0 ? 'text-sm' : 'text-sm'}>
            {category.name}
          </span>

          {isSelected && (
            <Check className="w-4 h-4 text-[#960018] shrink-0" />
          )}
        </button>

        {children.length > 0 && (
          <button
            type="button"
            onClick={() => toggleCategoryExpanded(category.id)}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category.name}`}
            aria-expanded={isExpanded}
            className="p-3 text-gray-500 hover:text-[#960018] transition"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {children.length > 0 && isExpanded && (
        <div className="space-y-1">
          {children.map(child => renderCategory(child, depth + 1))}
        </div>
      )}
    </div>
  );
};

  const homeDecorCategories = categories.filter(
  category => category.parent_id === homeDecorId
);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter products"
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="text-2xl font-serif text-[#2B1F3D]">
            Filter Products
          </h2>

          <button onClick={onClose} aria-label="Close filters">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading && (
            <p className="text-sm text-gray-500 py-4">
              Loading filters...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 py-4">{error}</p>
          )}

          {!loading && !error && (
            <>
              {/* <div className="border-b">
                {sectionHeader('categories', 'Categories')}

                
{expanded.includes('categories') && (
  <div className="pb-4 space-y-1">
    <button
      type="button"
      onClick={() => setCategoryId(undefined)}
      className={`w-full flex items-center justify-between text-left px-3 py-3 rounded-md transition ${
        categoryId === undefined
          ? 'bg-[#960018]/5 text-[#960018] font-medium'
          : 'text-[#2B1F3D] hover:bg-gray-50'
      }`}
    >
      <span className="text-sm">All Home Decor</span>

      {categoryId === undefined && (
        <Check className="w-4 h-4 text-[#960018]" />
      )}
    </button>

    {homeDecorId !== null ? (
      homeDecorCategories.map(category => renderCategory(category))
    ) : (
      <p className="px-3 py-3 text-sm text-gray-500">
        Home Decor category not found.
      </p>
    )}
  </div>
)}
              </div> */}

              <div className="border-b">
                {sectionHeader('collections', 'Collections')}

                {expanded.includes('collections') && (
                  <div className="pb-4 space-y-1">
                    {collections.map(collection => (
                      <label
                        key={collection.id}
                        className="flex items-center gap-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={collectionIds.includes(collection.id)}
                          onChange={() => toggleCollection(collection.id)}
                          className="accent-[#960018]"
                        />
                        <span className="text-sm text-gray-700">
                          {collection.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {attributeTypes.map(type => (
                <div key={type.id} className="border-b">
                  {sectionHeader(`attribute-${type.id}`, type.name)}

                  {expanded.includes(`attribute-${type.id}`) && (
                    <div className="pb-4 space-y-1">
                      {type.attribute_values.map(value => (
                        <label
                          key={value.id}
                          className="flex items-center gap-3 py-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(attributes[type.id] || []).includes(value.id)}
                            onChange={() => toggleAttribute(type.id, value.id)}
                            className="accent-[#960018]"
                          />
                          <span className="text-sm text-gray-700">
                            {value.value}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t px-6 py-4 grid grid-cols-2 gap-3 bg-white">
          <button
            onClick={handleReset}
            className="border border-gray-300 text-[#2B1F3D] py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Reset All
          </button>

          <button
            onClick={handleApply}
            disabled={loading || !!error}
            className="bg-[#2B1F3D] text-white py-3 rounded-lg font-semibold hover:bg-[#960018] transition disabled:opacity-50"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}
