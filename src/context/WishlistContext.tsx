import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types/product';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  items: Product[];
  isWishlisted: (productId: string) => boolean;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (product: Product) => void;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from localStorage as initial fallback for unauthenticated users
  const getLocalWishlist = (): Product[] => {
    try {
      const saved = localStorage.getItem('wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveLocalWishlist = (wishlistItems: Product[]) => {
    localStorage.setItem('wishlist', JSON.stringify(wishlistItems));
  };

  // Load wishlist: from DB if authenticated, from localStorage if not
  useEffect(() => {
    if (user) {
      fetchWishlistFromDB();
    } else {
      setItems(getLocalWishlist());
      setLoading(false);
    }
  }, [user]);

  const fetchWishlistFromDB = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wishlist')
        .select('product_id, products(*)')
        .eq('user_id', user.id);

      if (error) throw error;

      const wishlistProducts: Product[] = (data || [])
        .filter((row: any) => row.products)
        .map((row: any) => row.products as Product);

      setItems(wishlistProducts);
      saveLocalWishlist(wishlistProducts);
    } catch (err) {
      console.error('Error fetching wishlist:', err);
      setItems(getLocalWishlist());
    } finally {
      setLoading(false);
    }
  };

  const isWishlisted = useCallback((productId: string) => {
    return items.some((item) => item.id === productId);
  }, [items]);

  const addToWishlist = async (product: Product) => {
    if (isWishlisted(product.id)) return;

    // Optimistic update
    setItems((prev) => [...prev, product]);
    saveLocalWishlist([...items, product]);

    if (user) {
      try {
        const { error } = await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: product.id });

        if (error) throw error;
      } catch (err) {
        console.error('Error adding to wishlist:', err);
        setItems((prev) => prev.filter((item) => item.id !== product.id));
        saveLocalWishlist(items);
      }
    }
  };

  const removeFromWishlist = async (productId: string) => {
    const prevItems = items;
    setItems((prev) => prev.filter((item) => item.id !== productId));
    saveLocalWishlist(items.filter((item) => item.id !== productId));

    if (user) {
      try {
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;
      } catch (err) {
        console.error('Error removing from wishlist:', err);
        setItems(prevItems);
        saveLocalWishlist(prevItems);
      }
    }
  };

  const toggleWishlist = (product: Product) => {
    if (isWishlisted(product.id)) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  return (
    <WishlistContext.Provider value={{ items, isWishlisted, addToWishlist, removeFromWishlist, toggleWishlist, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
