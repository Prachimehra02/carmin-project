import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ hasSession: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  const checkAdminStatus = async (userId: string) => {
    try {
      setAdminLoading(true);
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
    } catch (err) {
      console.error('Failed to check admin status:', err);
      setIsAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await checkAdminStatus(currentUser.id);
        } else {
          setIsAdmin(false);
          setAdminLoading(false);
        }
      } catch (err) {
        console.error('Session error:', err);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Defer async work to avoid onAuthStateChange deadlock
      if (currentUser) {
        setTimeout(() => checkAdminStatus(currentUser.id), 0);
      } else {
        setIsAdmin(false);
        setAdminLoading(false);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  });

  if (error) throw error;

  if (!data.user) {
    throw new Error('Account could not be created.');
  }

  if (data.session) {
    // Immediately update AuthContext
    setUser(data.user);

    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: data.user.id,
          email: data.user.email || cleanEmail,
        },
        {
          onConflict: 'id',
        }
      );

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
    }
  }

  return {
    hasSession: !!data.session,
  };
};

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const signInWithOTP = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  };

  const verifyOTP = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, adminLoading, signUp, signIn, signOut, resetPassword, signInWithOTP, verifyOTP }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
