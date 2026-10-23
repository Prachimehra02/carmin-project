import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderStatusDef, PaymentStatusDef, ReturnStatusDef } from '../types/order';

interface StatusData {
  orderStatuses: OrderStatusDef[];
  paymentStatuses: PaymentStatusDef[];
  returnStatuses: ReturnStatusDef[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStatuses(): StatusData {
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusDef[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatusDef[]>([]);
  const [returnStatuses, setReturnStatuses] = useState<ReturnStatusDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderRes, paymentRes, returnRes] = await Promise.all([
        supabase.from('order_statuses').select('*').order('sequence', { ascending: true }),
        supabase.from('payment_statuses').select('*').order('created_at', { ascending: true }),
        supabase.from('return_statuses').select('*').order('sequence', { ascending: true }),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (paymentRes.error) throw paymentRes.error;
      if (returnRes.error) throw returnRes.error;

      setOrderStatuses(orderRes.data || []);
      setPaymentStatuses(paymentRes.data || []);
      setReturnStatuses(returnRes.data || []);
    } catch (err) {
      console.error('Error fetching statuses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    orderStatuses,
    paymentStatuses,
    returnStatuses,
    loading,
    error,
    refresh: fetchAll,
  };
}
