import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Product } from '../types/product';
import { Heart, Share2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import ShareModal from '../components/ShareModal';

interface ProductAttribute {
  name: string;
  value: string;
}

interface StorefrontVariant {
  id: string;
  sku: string;
  status: string;
  is_active: boolean;
  attributes: {
    attribute_type_id: number;
    name: string;
    value_id: number;
    value: string;
  }[];
  price: {
    mrp: number;
    selling_price: number;
    discount_percentage: number;
  } | null;
  stock_quantity: number;
  images: string[];
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const { products: relatedProducts } = useProducts({ sortBy: 'newest' });
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([]);
  const [variants, setVariants] = useState<StorefrontVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] =
  useState<Record<number, number>>({});

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .eq('status', 'published')
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          navigate('/products');
          return;
        }

        setProduct(data);

        const { data: variantData, error: variantError } = await supabase
  .from('product_variants')
  .select('id, sku, status, is_active')
  .eq('product_id', data.id)
  .eq('status', 'published')
  .eq('is_active', true);

if (variantError) throw variantError;

const variantIds = (variantData ?? []).map(v => v.id);

if (variantIds.length === 0) {
  setVariants([]);
  setSelectedVariantId(null);
} else {
  const [
    priceResult,
    inventoryResult,
    mediaResult,
    attributeResult
  ] = await Promise.all([
    supabase
      .from('variant_prices')
      .select('variant_id, mrp, selling_price, discount_percentage')
      .in('variant_id', variantIds)
      .is('effective_to', null),

    supabase
      .from('variant_inventory')
      .select('variant_id, stock_quantity')
      .in('variant_id', variantIds),

    supabase
      .from('variant_media')
      .select(`
        variant_id,
        sort_order,
        is_primary,
        media_assets (
          public_url
        )
      `)
      .in('variant_id', variantIds),

    supabase
      .from('variant_attribute_values')
      .select(`
        variant_id,
        attribute_values (
          id,
          value,
          active,
          attribute_types (
            id,
            name,
            active
          )
        )
      `)
      .in('variant_id', variantIds)
  ]);

  if (priceResult.error) throw priceResult.error;
  if (inventoryResult.error) throw inventoryResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (attributeResult.error) throw attributeResult.error;

  const loadedVariants: StorefrontVariant[] = (variantData ?? []).map(v => {
    const price = priceResult.data?.find(p => p.variant_id === v.id);
    const inventory = inventoryResult.data?.find(i => i.variant_id === v.id);

    const images = (mediaResult.data ?? [])
      .filter(m => m.variant_id === v.id)
      .sort((a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.sort_order - b.sort_order
      )
      .map(m => {
        const media = Array.isArray(m.media_assets)
          ? m.media_assets[0]
          : m.media_assets;

        return media?.public_url;
      })
      .filter((url): url is string => Boolean(url));

    const attributes = (attributeResult.data ?? [])
      .filter(a => a.variant_id === v.id)
      .flatMap(a => {
        const value = Array.isArray(a.attribute_values)
          ? a.attribute_values[0]
          : a.attribute_values;

        if (!value || !value.active) return [];

        const type = Array.isArray(value.attribute_types)
          ? value.attribute_types[0]
          : value.attribute_types;

        if (!type || !type.active) return [];

        return [{
          attribute_type_id: type.id,
          name: type.name,
          value_id: value.id,
          value: value.value
        }];
      });

    return {
      id: v.id,
      sku: v.sku,
      status: v.status,
      is_active: v.is_active,
      attributes,
      price: price
        ? {
            mrp: Number(price.mrp),
            selling_price: Number(price.selling_price),
            discount_percentage: Number(price.discount_percentage ?? 0)
          }
        : null,
      stock_quantity: Number(inventory?.stock_quantity ?? 0),
      images
    };
  });
  console.log('VARIANT DEBUG:', {
  productId: data.id,
  defaultVariantId: data.default_variant_id,
  variantData,
  prices: priceResult.data,
  inventory: inventoryResult.data,
  loadedVariants
});

  setVariants(loadedVariants);

  const defaultVariant = loadedVariants.find(
    v => v.id === data.default_variant_id
  );

  setSelectedVariantId(
    defaultVariant?.id ??
    (loadedVariants.length === 1 ? loadedVariants[0].id : null)
  );
}

        const { data: attributeData, error: attributeError } = await supabase
  .from('product_attribute_values')
  .select(`
    attribute_values (
      value,
      active,
      attribute_types (
        name,
        active
      )
    )
  `)
  .eq('product_id', id);

if (attributeError) {
  console.error('Error fetching product attributes:', attributeError);
  setProductAttributes([]);
} else {
  const attributes: ProductAttribute[] = [];

  for (const row of attributeData || []) {
    const rawValue = row.attribute_values;
    const attributeValue = Array.isArray(rawValue)
      ? rawValue[0]
      : rawValue;

    if (!attributeValue || !attributeValue.active) continue;

    const rawType = attributeValue.attribute_types;
    const attributeType = Array.isArray(rawType)
      ? rawType[0]
      : rawType;

    if (!attributeType || !attributeType.active) continue;

    attributes.push({
      name: attributeType.name,
      value: attributeValue.value,
    });
  }

  setProductAttributes(attributes);
}
      } catch (error) {
        console.error('Error fetching product:', error);
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate]);

  useEffect(() => {
  const variant = variants.find(v => v.id === selectedVariantId);

  if (variant) {
    setSelectedOptions(
      Object.fromEntries(
        variant.attributes.map(a => [
          a.attribute_type_id,
          a.value_id
        ])
      )
    );
  }

  setSelectedImageIndex(0);
  setQuantity(1);
}, [selectedVariantId, variants]);

  const selectedVariant = variants.find(
  variant => variant.id === selectedVariantId
) ?? null;

  const optionGroups = Array.from(
  new Map(
    variants.flatMap(v =>
      v.attributes.map(a => [a.attribute_type_id, a.name] as const)
    )
  )
).map(([typeId, name]) => ({
  typeId,
  name,
  options: Array.from(
    new Map(
      variants.flatMap(v =>
        v.attributes
          .filter(a => a.attribute_type_id === typeId)
          .map(a => [a.value_id, a.value] as const)
      )
    )
  ).map(([id, value]) => ({ id, value }))
}));

const handleOptionSelect = (typeId: number, valueId: number) => {
  const nextOptions = {
    ...selectedOptions,
    [typeId]: valueId
  };

  setSelectedOptions(nextOptions);

  const matchingVariant = variants.find(v =>
    optionGroups.every(group =>
      v.attributes.some(a =>
        a.attribute_type_id === group.typeId &&
        a.value_id === nextOptions[group.typeId]
      )
    )
  );

  setSelectedVariantId(matchingVariant?.id ?? null);
};

const currentMrp = selectedVariant?.price?.mrp ?? 0;
const currentSellingPrice = selectedVariant?.price?.selling_price ?? 0;
const currentStock = selectedVariant?.stock_quantity ?? 0;

const currentImages = selectedVariant?.images ?? [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#960018]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Product not found</p>
      </div>
    );
  }

  const images = currentImages;
  const filteredRelated = relatedProducts
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !selectedVariant.price) return;

  if (
    currentStock <= 0 ||
    quantity < 1 ||
    quantity > currentStock
  ) return;
    addToCart({
      id: product.id,
  variant_id: selectedVariant.id,
  name: product.name,
  price: currentMrp,
  sale_price: currentSellingPrice,
  quantity,
  image: currentImages[0] ?? '',
  stock_quantity: currentStock,
      variant_attributes: selectedVariant.attributes.map(attribute => ({
    name: attribute.name,
    value: attribute.value
  }))
    });
    setQuantity(1);
  };

  const handleToggleWishlist = () => {
    if (product) {
      toggleWishlist(product);
    }
  };

  return (
    <div className="pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-2 text-[#2B1F3D] hover:text-[#960018] transition mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Products
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image Gallery */}
          <div>
            <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square mb-4">
              <img
                src={images[selectedImageIndex] || '/carousel1.jpeg'}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition z-10"
                  >
                    <ChevronLeft className="w-6 h-6 text-[#2B1F3D]" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full transition z-10"
                  >
                    <ChevronRight className="w-6 h-6 text-[#2B1F3D]" />
                  </button>
                </>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition ${
                      idx === selectedImageIndex ? 'bg-[#960018]' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>

            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((image, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`rounded-lg overflow-hidden border-2 transition ${
                      idx === selectedImageIndex
                        ? 'border-[#960018]'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${idx + 1}`}
                      className="w-full h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col justify-between">
            <div>
              <h1 className="text-4xl font-serif text-[#2B1F3D] mb-3">{product.name}</h1>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  {currentSellingPrice != null && currentSellingPrice < currentMrp ? (
                    <>
                      <p className="text-3xl font-semibold text-[#960018]">₹{currentSellingPrice.toLocaleString()}</p>
                      <p className="text-xl text-stone-400 line-through">₹{currentMrp.toLocaleString()}</p>
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">
                        {Math.round((1 - currentSellingPrice / currentMrp) * 100)}% OFF
                      </span>
                    </>
                  ) : (
                    <p className="text-3xl font-semibold text-[#960018]">₹{currentMrp.toLocaleString()}</p>
                  )}
                </div>
                {currentStock > 0 ? (
                  currentStock <= 5 ? (
                    <p className="text-sm text-orange-600 font-medium">Only {currentStock} left in stock!</p>
                  ) : (
                    <p className="text-sm text-green-600 font-medium">In Stock</p>
                  )
                ) : (
                  <p className="text-sm text-red-600 font-medium">Out of Stock</p>
                )}
              </div>

              <p className="text-gray-700 leading-relaxed mb-8 text-lg">
                {product.description}
              </p>

              {optionGroups.length > 0 && (
  <div className="mb-8 space-y-5">
    {optionGroups.map(group => (
      <div key={group.typeId}>
        <label className="block text-sm font-semibold text-[#2B1F3D] mb-3">
          {group.name}
        </label>

        <div className="flex flex-wrap gap-3">
          {group.options.map(option => {
            const selected =
              selectedOptions[group.typeId] === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  handleOptionSelect(group.typeId, option.id)
                }
                className={`px-4 py-2 rounded-lg border transition ${
                  selected
                    ? 'border-[#960018] bg-[#960018]/10 text-[#960018]'
                    : 'border-gray-300 hover:border-[#960018]'
                }`}
              >
                {option.value}
              </button>
            );
          })}
        </div>
      </div>
    ))}

    {!selectedVariant && (
      <p className="text-sm text-orange-600">
        Please select an available combination.
      </p>
    )}
  </div>
)}

              {/* Quantity Selector */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-[#2B1F3D] mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-4 w-fit border border-gray-300 rounded-lg p-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1 hover:bg-gray-100 transition"
                  >
                    −
                  </button>
                  <span className="px-6 font-semibold min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() =>
  setQuantity(Math.min(currentStock, quantity + 1))
}
disabled={!selectedVariant || currentStock <= 0}
                    className="px-3 py-1 hover:bg-gray-100 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 mb-8">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedVariant ||
  !selectedVariant.price ||
  currentStock <= 0 ||
  quantity > currentStock}
                  className="flex-1 bg-[#2B1F3D] text-white py-4 rounded-lg font-semibold hover:bg-[#960018] transition flex items-center justify-center gap-2 disabled:bg-stone-400 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {currentStock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button
                  onClick={handleToggleWishlist}
                  className={`px-6 py-4 rounded-lg border-2 transition ${
                    isWishlisted(product.id)
                      ? 'border-[#960018] bg-[#960018]/10'
                      : 'border-gray-300 hover:border-[#960018]'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${isWishlisted(product.id) ? 'fill-[#960018] text-[#960018]' : 'text-gray-600'}`}
                  />
                </button>
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="px-6 py-4 rounded-lg border-2 border-gray-300 hover:border-[#960018] transition"
                >
                  <Share2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-gray-600 border-t pt-6">
                <p>✓ Free delivery on orders above ₹500</p>
                <p>✓ Dispatches within 3-4 business days</p>
                <p>✓ Easy returns within 14 days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="border-t pt-16">
          <div className="mb-12">
            <h2 className="text-2xl font-serif text-[#2B1F3D] mb-6">Product Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-[#2B1F3D] mb-3 text-lg">Description</h3>
                <p className="text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Product attributes and tags */}
              {productAttributes.length > 0 && (
  <div>
    <h3 className="font-semibold text-[#2B1F3D] mb-4 text-lg">
      Product Specifications
    </h3>

    <dl className="divide-y divide-gray-100">
      {productAttributes.map((attribute) => (
        <div
          key={attribute.name}
          className="flex justify-between gap-6 py-3 text-sm"
        >
          <dt className="font-medium text-[#2B1F3D]">
            {attribute.name}
          </dt>
          <dd className="text-gray-600 text-right">
            {attribute.value}
          </dd>
        </div>
      ))}
    </dl>
  </div>
)}
              <div>
                <h3 className="font-semibold text-[#2B1F3D] mb-3 text-lg">Shipping & Returns</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Free delivery across India</li>
                  <li>• Standard delivery within 3-10 working days</li>
                  <li>• Easy returns within 14 days</li>
                  <li>• COD available on all orders</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Care Instructions */}
          <div className="mb-16 bg-gray-50 rounded-lg p-8">
            <h3 className="text-2xl font-serif text-[#2B1F3D] mb-4">How to Care</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your product is carefully crafted to last. We recommend:
            </p>
            <ul className="space-y-2 text-gray-700 list-disc list-inside">
              <li>Clean with a soft, dry cloth after each use</li>
              <li>Avoid harsh chemicals and abrasive materials</li>
              <li>Store in a cool, dry place away from direct sunlight</li>
              <li>Handle with care to prevent accidental drops</li>
            </ul>
          </div>
        </div>

        {/* Related Products */}
        {filteredRelated.length > 0 && (
          <div className="border-t pt-16">
            <h2 className="text-3xl font-serif text-[#2B1F3D] mb-12">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredRelated.map((relatedProduct) => (
                <div
                  key={relatedProduct.id}
                  onClick={() => navigate(`/product/${relatedProduct.id}`)}
                  className="cursor-pointer group"
                >
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square mb-4">
                    <img
                      src={Array.isArray(relatedProduct.images) ? relatedProduct.images[0] : '/carousel1.jpeg'}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <h3 className="font-semibold text-[#2B1F3D] text-lg mb-2">{relatedProduct.name}</h3>
                  <p className="text-[#960018] font-semibold text-lg">₹{relatedProduct.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {product && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          productName={product.name}
          productUrl={`${window.location.origin}/product/${product.id}`}
        />
      )}
    </div>
  );
}
