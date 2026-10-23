import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle2, Circle,
  XCircle, AlertCircle, Copy, Check, X, RotateCcw, ChevronRight, Download,
} from 'lucide-react';
import type {
  Order, OrderStatusDef, PaymentStatusDef, ReturnStatusDef,
  OrderStatusHistory,
} from '../types/order';

const RETURN_REASONS = [
  'Damaged Product',
  'Wrong Product',
  'Defective',
  'Quality Issue',
  'Changed Mind',
  'Other',
];

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [orderStatuses, setOrderStatuses] = useState<OrderStatusDef[]>([]);
  const [returnStatuses, setReturnStatuses] = useState<ReturnStatusDef[]>([]);

  const [history, setHistory] = useState<OrderStatusHistory[]>([]);

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnOtherReason, setReturnOtherReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !user) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id, quantity, price, taxable_amount, tax_percentage, tax_amount, cgst_amount, sgst_amount, igst_amount, cess_amount, line_total, hsn_code, cgst_percentage, sgst_percentage, igst_percentage, cess_percentage, product_name, product_sku, product_id, products (id, name, sku, images)
          ),
          order_status_def:order_statuses!orders_order_status_id_fkey ( * ),
          payment_status_def:payment_statuses!orders_payment_status_id_fkey ( * ),
          return_status_def:return_statuses!orders_return_status_id_fkey ( * )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setNotFound(true);
        return;
      }
      setOrder(data as unknown as Order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  const fetchStatuses = useCallback(async () => {
    try {
      const [oRes, rRes] = await Promise.all([
        supabase.from('order_statuses').select('*').eq('active', true).order('sequence', { ascending: true }),
        supabase.from('return_statuses').select('*').eq('active', true).order('sequence', { ascending: true }),
      ]);
      if (oRes.error) throw oRes.error;
      if (rRes.error) throw rRes.error;
      setOrderStatuses(oRes.data || []);
      setReturnStatuses(rRes.data || []);
    } catch (err) {
      console.error('Error fetching statuses:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!orderId) return;
    try {
      const { data, error: histError } = await supabase
        .from('order_status_history')
        .select(`
          *,
          new_status:order_statuses!order_status_history_new_status_id_fkey(*),
          old_status:order_statuses!order_status_history_old_status_id_fkey(*)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (histError) throw histError;
      setHistory((data || []) as unknown as OrderStatusHistory[]);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, [orderId]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    void fetchOrder();
    void fetchStatuses();
  }, [user, navigate, fetchOrder, fetchStatuses]);

  useEffect(() => {
    if (order) void fetchHistory();
  }, [order, fetchHistory]);

  // ── Derived values ──

  const osDef = (order as any)?.order_status_def as OrderStatusDef | undefined;
  const psDef = (order as any)?.payment_status_def as PaymentStatusDef | undefined;
  const rsDef = (order as any)?.return_status_def as ReturnStatusDef | undefined;

  const shippedStatus = orderStatuses.find((s) => s.code === 'shipped');
  const deliveredStatus = orderStatuses.find((s) => s.code === 'delivered');
  const cancelledStatus = orderStatuses.find((s) => s.code === 'cancelled');

  // Customer can cancel if current order status sequence < shipped sequence
  const canCancel =
    !!osDef &&
    !!shippedStatus &&
    osDef.sequence < shippedStatus.sequence &&
    osDef.code !== 'cancelled';

  // Customer can request return if order is delivered AND return status is 'none'
  const canReturn =
    !!osDef &&
    !!deliveredStatus &&
    osDef.code === 'delivered' &&
    !!rsDef &&
    rsDef.code === 'none';

  // Customer-visible statuses for timeline
  const customerVisibleStatuses = orderStatuses.filter((s) => s.show_to_customer);

  // ── Actions ──

  const handleCancelOrder = async () => {
    if (!order || !cancelledStatus) return;
    setCancelLoading(true);
    setActionError(null);
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status_id: cancelledStatus.id,
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Add a note to the latest history entry via a separate insert
      if (cancelReason.trim()) {
        const { error: noteError } = await supabase
          .from('order_status_history')
          .update({ notes: `Cancellation reason: ${cancelReason.trim()}` })
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (noteError) console.error('Failed to add cancel note:', noteError);
      }

      setActionSuccess('Order cancelled successfully.');
      setShowCancelDialog(false);
      setCancelReason('');
      await fetchOrder();
      await fetchHistory();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!order) return;
    const requestedStatus = returnStatuses.find((s) => s.code === 'requested');
    if (!requestedStatus) return;

    const reason = returnReason === 'Other' ? returnOtherReason.trim() : returnReason;
    if (!reason) {
      setActionError('Please select a return reason.');
      return;
    }

    setReturnLoading(true);
    setActionError(null);
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ return_status_id: requestedStatus.id })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Insert return status history with reason as note
      const { error: histError } = await supabase
        .from('return_status_history')
        .insert([{
          order_id: order.id,
          new_status_id: requestedStatus.id,
          notes: `Return reason: ${reason}`,
        }]);

      if (histError) console.error('Failed to add return history:', histError);

      setActionSuccess('Return request submitted. Admin will review it shortly.');
      setShowReturnDialog(false);
      setReturnReason('');
      setReturnOtherReason('');
      await fetchOrder();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit return request');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleCopyTracking = () => {
    if (!order?.tracking_id) return;
    navigator.clipboard.writeText(order.tracking_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render helpers ──

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Loading / Error / Not Found ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#960018]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24 px-4">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Order not found</h1>
          <p className="text-stone-600 mb-6">This order doesn't exist or you don't have permission to view it.</p>
          <Link to="/profile" className="inline-flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24 px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Something went wrong</h1>
          <p className="text-stone-600 mb-6">{error || 'Failed to load order'}</p>
          <Link to="/profile" className="inline-flex items-center gap-2 bg-[#960018] hover:bg-[#6F0012] text-white font-semibold px-6 py-3 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const orderItems = order.order_items || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 pt-4 px-4 pb-12">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-stone-600 hover:text-[#960018] transition-colors mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Orders
        </button>

        {/* Action feedback */}
        {actionError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm">{actionError}</p>
          </div>
        )}
        {actionSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm">{actionSuccess}</p>
          </div>
        )}

        {/* ── Header ── */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">
                Order <span className="font-mono">#{order.order_number}</span>
              </h1>
              <p className="text-sm text-stone-500">Placed on {formatDateTime(order.created_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
  {osDef && (
    <span
      className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium ${osDef.color}`}
    >
      {osDef.name}
    </span>
  )}

  {psDef && (
    <span
      className={`inline-block px-3 py-1.5 rounded-full text-xs font-medium ${psDef.color}`}
    >
      {psDef.name}
    </span>
  )}

  {rsDef && rsDef.code !== 'none' && (
    <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      Return: {rsDef.name}
    </span>
  )}

  {order.invoice_number && (
    <Link
    to={`/account/orders/${order.id}/invoice`}
    className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#960018] text-[#960018] hover:bg-[#960018] hover:text-white rounded-lg text-xs font-medium transition-colors"
  >
      <Download className="w-4 h-4" />
      Download Invoice
    </Link>
  )}
</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column: Timeline + Items + History ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Order Timeline</h2>
              <div className="space-y-1">
                {customerVisibleStatuses.map((status) => {
                  const histEntry = history.find((h) => h.new_status_id === status.id);
                  const isCompleted = !!histEntry;
                  const isCurrent = osDef?.id === status.id;
                  const isCancelledStatus = status.code === 'cancelled';
                  const orderIsCancelled = osDef?.code === 'cancelled';

                  // If order is cancelled, only show up to cancelled
                  if (orderIsCancelled && !isCancelledStatus && status.sequence > (cancelledStatus?.sequence || 0)) {
                    return null;
                  }

                  return (
                    <div key={status.id} className="flex items-start gap-3 py-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {isCompleted ? (
                          <CheckCircle2 className={`w-5 h-5 ${isCancelledStatus ? 'text-red-500' : 'text-green-500'}`} />
                        ) : isCurrent ? (
                          <Circle className="w-5 h-5 text-[#960018] fill-[#f7e8eb]" />
                        ) : (
                          <Circle className="w-5 h-5 text-stone-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isCompleted ? (isCancelledStatus ? 'text-red-700' : 'text-stone-900') :
                          isCurrent ? 'text-[#6F0012]' : 'text-stone-400'
                        }`}>
                          {status.name}
                        </p>
                        {histEntry && (
                          <p className="text-xs text-stone-500 mt-0.5">{formatDate(histEntry.created_at)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Products */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Products</h2>
              <div className="space-y-4">
                {orderItems.map((item: any) => {
                  const lineTotal = item.line_total ? Number(item.line_total) : item.price * item.quantity;
                  const taxAmount = item.tax_amount ? Number(item.tax_amount) : 0;
                  const total = lineTotal + taxAmount;
                  return (
                    <div key={item.id || item.product_id} className="flex gap-4 pb-4 border-b border-stone-100 last:border-0 last:pb-0">
                      <img
                        src={item.products?.images?.[0] || item.image}
                        alt={item.products?.name || item.product_name || item.name}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-stone-900 text-sm">
                          {item.products?.name || item.product_name || item.name}
                        </h3>
                        <p className="text-xs text-stone-500 font-mono mt-0.5">
                          SKU: {item.products?.sku || item.product_sku || item.sku || '—'}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-stone-600">
                          <div><span className="text-stone-400">Qty:</span> {item.quantity}</div>
                          <div><span className="text-stone-400">Price:</span> ₹{item.price.toLocaleString()}</div>
                          <div><span className="text-stone-400">GST:</span> {item.tax_percentage ? `${item.tax_percentage}%` : '—'}</div>
                          <div><span className="text-stone-400">Tax:</span> {taxAmount > 0 ? `₹${taxAmount.toLocaleString()}` : '—'}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-stone-900 text-sm">₹{total.toLocaleString()}</p>
                        <p className="text-xs text-stone-400 mt-0.5">Line total</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status History */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Status History</h2>
              {history.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-4">No status history available</p>
              ) : (
                <div className="space-y-3">
                  {history
                    .filter((h) => {
                      const def = h.new_status as OrderStatusDef | undefined;
                      return def?.show_to_customer !== false;
                    })
                    .map((h) => {
                      const newDef = h.new_status as OrderStatusDef | undefined;
                      const oldDef = h.old_status as OrderStatusDef | undefined;
                      return (
                        <div key={h.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-stone-50 last:border-0">
                          <div className={`w-2 h-2 rounded-full ${newDef?.color?.split(' ')[0] || 'bg-gray-400'}`} />
                          <span className="text-stone-500 w-32 flex-shrink-0">{formatDate(h.created_at)}</span>
                          <span className="text-stone-400">{oldDef?.name || '—'}</span>
                          <ChevronRight className="w-3 h-3 text-stone-300" />
                          <span className="font-medium text-stone-900">{newDef?.name}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: Summary + Address + Delivery + Payment + Actions ── */}
          <div className="space-y-6">
            {/* Pricing Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-4">Pricing Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal</span>
                  <span className="font-medium">₹{(order.subtotal || 0).toLocaleString()}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Discount</span>
                    <span className="font-medium text-green-600">-₹{(order.discount || 0).toLocaleString()}</span>
                  </div>
                )}
                {order.coupon_code && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Coupon</span>
                    <span className="font-mono text-xs bg-[#960018]/5 text-[#6F0012] px-2 py-0.5 rounded">{order.coupon_code}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-600">Shipping</span>
                  <span className="font-medium">{(order.shipping_charge || 0) === 0 ? 'FREE' : `₹${order.shipping_charge?.toLocaleString()}`}</span>
                </div>
                {/* GST Breakdown */}
{Number(order.cgst_amount || 0) > 0 && (
  <div className="flex justify-between">
    <span className="text-stone-600">CGST</span>
    <span className="font-medium">
      ₹{Number(order.cgst_amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  </div>
)}

{Number(order.sgst_amount || 0) > 0 && (
  <div className="flex justify-between">
    <span className="text-stone-600">SGST</span>
    <span className="font-medium">
      ₹{Number(order.sgst_amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  </div>
)}

{Number(order.igst_amount || 0) > 0 && (
  <div className="flex justify-between">
    <span className="text-stone-600">IGST</span>
    <span className="font-medium">
      ₹{Number(order.igst_amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  </div>
)}
                <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold">
                  <span className="text-stone-900">Grand Total</span>
                  <span className="text-[#960018]">₹{(order.grand_total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-stone-400" /> Shipping Address
              </h2>
              {order.shipping_address ? (
                <div className="text-sm text-stone-600 space-y-1">
                  <p className="font-medium text-stone-900">{order.shipping_address.full_name}</p>
                  <p>{order.shipping_address.phone}</p>
                  <p>{order.shipping_address.address_line_1}</p>
                  {order.shipping_address.address_line_2 && <p>{order.shipping_address.address_line_2}</p>}
                  <p>{order.shipping_address.city}, {order.shipping_address.state}</p>
                  <p>PIN: {order.shipping_address.pincode}</p>
                </div>
              ) : (
                <p className="text-sm text-stone-500">No shipping address on file</p>
              )}
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-stone-400" /> Delivery Information
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Courier</span>
                  <span className="font-medium">{order.courier_name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Tracking No.</span>
                  {order.tracking_id ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-stone-900">{order.tracking_id}</span>
                      <button
                        onClick={handleCopyTracking}
                        className="p-1 text-stone-400 hover:text-[#960018] transition-colors"
                        title="Copy tracking number"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">AWB Number</span>
                  <span className="font-medium">{order.awb_number || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Expected Delivery</span>
                  <span className="font-medium">{order.expected_delivery ? formatDate(order.expected_delivery) : '—'}</span>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-stone-400" /> Payment Information
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Payment Method</span>
                  <span className="font-medium uppercase">{order.payment_method || 'COD'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Payment Status</span>
                  {psDef && (
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${psDef.color}`}>
                      {psDef.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3">Actions</h2>
              <div className="space-y-3">
                {canCancel && (
                  <button
                    onClick={() => { setShowCancelDialog(true); setActionError(null); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Cancel Order
                  </button>
                )}
                {canReturn && (
                  <button
                    onClick={() => { setShowReturnDialog(true); setActionError(null); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#960018]/20 text-[#6F0012] hover:bg-[#960018]/5 rounded-lg transition-colors font-medium text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Request Return
                  </button>
                )}
                {!canCancel && !canReturn && (
                  <p className="text-sm text-stone-500 text-center py-2">
                    {osDef?.is_terminal && osDef?.code !== 'delivered'
                      ? 'This order is complete.'
                      : 'No actions available for this order.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cancel Dialog ── */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Cancel Order</h3>
              <button onClick={() => setShowCancelDialog(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              Are you sure you want to cancel this order? This action cannot be undone. Payment refunds (if applicable) will be handled separately by our team.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-900 mb-2">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Tell us why you're cancelling..."
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018] text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors font-medium text-sm"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Dialog ── */}
      {showReturnDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Request Return</h3>
              <button onClick={() => setShowReturnDialog(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              Please select a reason for your return request. Our team will review it and get back to you.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-900 mb-2">Return Reason</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018] text-sm"
              >
                <option value="">Select a reason...</option>
                {RETURN_REASONS.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
            {returnReason === 'Other' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-900 mb-2">Please specify</label>
                <textarea
                  value={returnOtherReason}
                  onChange={(e) => setReturnOtherReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the issue..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-[#960018] text-sm"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowReturnDialog(false)}
                className="flex-1 px-4 py-2 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReturn}
                disabled={returnLoading}
                className="flex-1 px-4 py-2 bg-[#960018] text-white hover:bg-[#6F0012] rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              >
                {returnLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
