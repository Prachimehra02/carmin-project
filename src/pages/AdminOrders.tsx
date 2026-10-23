import { useState, useEffect, useCallback } from 'react';
import { Search, AlertCircle, X } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import { useStatuses } from '../hooks/useStatuses';
import type { Order, OrderStatusDef, PaymentStatusDef, ReturnStatusDef } from '../types/order';

export default function AdminOrders() {
  const { orderStatuses, paymentStatuses, returnStatuses } = useStatuses();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatusId, setFilterStatusId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingId, setTrackingId] = useState('');
  const [courierName, setCourierName] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [newOrderStatusId, setNewOrderStatusId] = useState<string>('');
  const [newPaymentStatusId, setNewPaymentStatusId] = useState<string>('');
  const [newReturnStatusId, setNewReturnStatusId] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'order' | 'payment' | 'return'>('order');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id, quantity, price, tax_percentage, tax_amount,
            line_total, product_name, product_sku, product_id,
            products ( id, name, sku, images )
          ),
          order_status_def:order_statuses!orders_order_status_id_fkey ( * ),
          payment_status_def:payment_statuses!orders_payment_status_id_fkey ( * ),
          return_status_def:return_statuses!orders_return_status_id_fkey ( * )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setOrders((data || []) as unknown as Order[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const fetchHistory = async (orderId: string) => {
    try {
      const [ohRes, phRes, rhRes] = await Promise.all([
        supabase
          .from('order_status_history')
          .select('*, new_status:order_statuses!order_status_history_new_status_id_fkey(*), old_status:order_statuses!order_status_history_old_status_id_fkey(*)')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('payment_status_history')
          .select('*, new_status:payment_statuses!payment_status_history_new_status_id_fkey(*), old_status:payment_statuses!payment_status_history_old_status_id_fkey(*)')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
        supabase
          .from('return_status_history')
          .select('*, new_status:return_statuses!return_status_history_new_status_id_fkey(*), old_status:return_statuses!return_status_history_old_status_id_fkey(*)')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }),
      ]);
      setOrderHistory(ohRes.data || []);
      setPaymentHistory(phRes.data || []);
      setReturnHistory(rhRes.data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setNewOrderStatusId(order.order_status_id || '');
    setNewPaymentStatusId(order.payment_status_id || '');
    setNewReturnStatusId(order.return_status_id || '');
    setTrackingId(order.tracking_id || '');
    setCourierName(order.courier_name || '');
    setAwbNumber(order.awb_number || '');
    setExpectedDelivery(order.expected_delivery || '');
    setActiveHistoryTab('order');
    void fetchHistory(order.id);
  };

  const fetchSingleOrder = async (orderId: string): Promise<Order | null> => {
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id, quantity, price, tax_percentage, tax_amount,
          line_total, product_name, product_sku, product_id,
          products ( id, name, sku, images )
        ),
        order_status_def:order_statuses!orders_order_status_id_fkey ( * ),
        payment_status_def:payment_statuses!orders_payment_status_id_fkey ( * ),
        return_status_def:return_statuses!orders_return_status_id_fkey ( * )
      `)
      .eq('id', orderId)
      .single();
    if (fetchError) throw fetchError;
    return data as unknown as Order;
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder) return;
    try {
      setUpdating(true);
      setError(null);
      const updates: any = {};

      if (newOrderStatusId && newOrderStatusId !== selectedOrder.order_status_id) {
        updates.order_status_id = newOrderStatusId;
      }

      if (newPaymentStatusId && newPaymentStatusId !== selectedOrder.payment_status_id) {
        updates.payment_status_id = newPaymentStatusId;
      }

      if (newReturnStatusId && newReturnStatusId !== selectedOrder.return_status_id) {
        updates.return_status_id = newReturnStatusId;
      }

      if (trackingId !== (selectedOrder.tracking_id || '')) {
        updates.tracking_id = trackingId || null;
      }

      if (courierName !== (selectedOrder.courier_name || '')) {
        updates.courier_name = courierName || null;
        }
      
      if (awbNumber !== (selectedOrder.awb_number || '')) {
        updates.awb_number = awbNumber || null;
        }
      
      if (expectedDelivery !== (selectedOrder.expected_delivery || '')) {
        updates.expected_delivery = expectedDelivery || null;
        }

      if (Object.keys(updates).length === 0) {
        return;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', selectedOrder.id);

      if (updateError) throw updateError;

      // Refresh from database so joined status definitions, counts, and list are all fresh
      await fetchOrders();
      const refreshed = await fetchSingleOrder(selectedOrder.id);
      if (refreshed) {
        setSelectedOrder(refreshed);
        setNewOrderStatusId(refreshed.order_status_id || '');
        setNewPaymentStatusId(refreshed.payment_status_id || '');
        setNewReturnStatusId(refreshed.return_status_id || '');
        setTrackingId(refreshed.tracking_id || '');
        setCourierName(refreshed.courier_name || '');
        setAwbNumber(refreshed.awb_number || '');
        setExpectedDelivery(refreshed.expected_delivery || '');
        void fetchHistory(refreshed.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      filterStatusId === 'all' || order.order_status_id === filterStatusId;
    const matchesSearch =
      searchQuery === '' ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.tracking_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = orders.reduce((acc, o) => {
    const id = o.order_status_id || 'unknown';
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeOrderStatuses = orderStatuses.filter((s) => s.active);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Orders</h2>
          <p className="text-gray-600 mt-1">Manage customer orders</p>
        </div>

        {/* Status filter cards — dynamically generated from DB */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <button
            onClick={() => setFilterStatusId('all')}
            className={`p-3 rounded-lg border transition text-left ${
              filterStatusId === 'all'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">All</span>
            </div>
            <p className="text-2xl font-bold">{orders.length}</p>
          </button>
          {activeOrderStatuses.map((status) => (
            <button
              key={status.id}
              onClick={() => setFilterStatusId((prev) => (prev === status.id ? 'all' : status.id))}
              className={`p-3 rounded-lg border transition text-left ${
                filterStatusId === status.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block w-3 h-3 rounded-full ${status.color.split(' ')[0]}`} />
                <span className="text-xs font-medium truncate">{status.name}</span>
              </div>
              <p className="text-2xl font-bold">{statusCounts[status.id] || 0}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order ID or tracking number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">No orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Order No</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Order Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Payment</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Return</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tracking</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredOrders.map((order) => {
                      const osDef = (order as any).order_status_def as OrderStatusDef | undefined;
                      const psDef = (order as any).payment_status_def as PaymentStatusDef | undefined;
                      const rsDef = (order as any).return_status_def as ReturnStatusDef | undefined;
                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-mono text-sm text-gray-900">{order.order_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${osDef?.color || 'bg-gray-100 text-gray-800'}`}>
                              {osDef?.name || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${psDef?.color || 'bg-gray-100 text-gray-800'}`}>
                              {psDef?.name || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {rsDef?.name || 'None'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">₹{(order.grand_total || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{order.tracking_id || '-'}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => openOrderDetail(order)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Order No</p>
                <p className="font-mono font-semibold">{selectedOrder.order_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold">{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Order Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${((selectedOrder as any).order_status_def as OrderStatusDef)?.color || 'bg-gray-100 text-gray-800'}`}>
                  {((selectedOrder as any).order_status_def as OrderStatusDef)?.name || '—'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Status</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${((selectedOrder as any).payment_status_def as PaymentStatusDef)?.color || 'bg-gray-100 text-gray-800'}`}>
                  {((selectedOrder as any).payment_status_def as PaymentStatusDef)?.name || '—'}
                </span>
              </div>
            </div>

            {/* Customer & Shipping */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Customer Information</h4>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{selectedOrder.shipping_address?.full_name}</p>
                  <p className="text-gray-600">{selectedOrder.shipping_address?.phone}</p>
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Shipping Address</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>{selectedOrder.shipping_address?.address_line_1}</p>
                  {selectedOrder.shipping_address?.address_line_2 && <p>{selectedOrder.shipping_address.address_line_2}</p>}
                  <p>{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.state}</p>
                  <p>{selectedOrder.shipping_address?.pincode}</p>
                </div>
              </div>
            </div>

            {/* Payment & Delivery */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment & Order</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Payment Method</span><span className="font-medium uppercase">{selectedOrder.payment_method || 'COD'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Coupon</span><span className="font-medium">{selectedOrder.coupon_code || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-medium text-green-600">₹{(selectedOrder.discount || 0).toLocaleString()}</span></div>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Delivery</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Courier</span><span className="font-medium">{selectedOrder.courier_name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tracking ID</span><span className="font-medium">{selectedOrder.tracking_id || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">AWB</span><span className="font-medium">{selectedOrder.awb_number || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expected</span><span className="font-medium">{selectedOrder.expected_delivery ? new Date(selectedOrder.expected_delivery).toLocaleDateString() : '-'}</span></div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">HSN</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">GST%</th>
                      <th className="px-3 py-2 text-right">CGST</th>
                      <th className="px-3 py-2 text-right">SGST</th>
                      <th className="px-3 py-2 text-right">Tax</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.order_items?.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.products?.images?.[0]} className="w-12 h-12 rounded object-cover" />
                            <span className="font-medium">{item.products?.name || item.product_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono">{item.products?.sku || item.product_sku}</td>
                        <td className="px-3 py-3 font-mono text-xs">{item.hsn_code || '—'}</td>
                        <td className="px-3 py-3 text-center">{item.quantity}</td>
                        <td className="px-3 py-3 text-right">₹{item.price.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.tax_percentage ? `${item.tax_percentage}%` : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.cgst_percentage ? `${item.cgst_percentage}%` : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.sgst_percentage ? `${item.sgst_percentage}%` : '—'}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{item.tax_amount ? `₹${Number(item.tax_amount).toLocaleString()}` : '—'}</td>
                        <td className="px-3 py-3 text-right font-semibold">₹{((item.line_total ? Number(item.line_total) : item.price * item.quantity) + Number(item.tax_amount || 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-2 mb-6">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">₹{(selectedOrder.subtotal || 0).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Discount</span><span className="font-medium text-green-600">-₹{(selectedOrder.discount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Shipping</span><span className="font-medium">{(selectedOrder.shipping_charge || 0) === 0 ? 'FREE' : `₹${selectedOrder.shipping_charge?.toLocaleString()}`}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Taxes</span><span className="font-medium">₹{(selectedOrder.tax_amount || 0).toLocaleString()}</span></div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold"><span>Grand Total</span><span>₹{(selectedOrder.grand_total || 0).toLocaleString()}</span></div>
            </div>

            {/* Status History Timeline */}
            <div className="mb-6">
              <div className="flex gap-2 mb-3">
                <button onClick={() => setActiveHistoryTab('order')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeHistoryTab === 'order' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Order History</button>
                <button onClick={() => setActiveHistoryTab('payment')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeHistoryTab === 'payment' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Payment History</button>
                <button onClick={() => setActiveHistoryTab('return')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeHistoryTab === 'return' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Return History</button>
              </div>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                {activeHistoryTab === 'order' && (orderHistory.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No status changes recorded</p> : (
                  <div className="space-y-3">
                    {orderHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full ${(h.new_status as OrderStatusDef)?.color?.split(' ')[0] || 'bg-gray-400'}`} />
                        <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
                        <span className="font-medium">{(h.old_status as OrderStatusDef)?.name || '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{(h.new_status as OrderStatusDef)?.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {activeHistoryTab === 'payment' && (paymentHistory.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No payment changes recorded</p> : (
                  <div className="space-y-3">
                    {paymentHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <div className={`w-2 h-2 rounded-full ${(h.new_status as PaymentStatusDef)?.color?.split(' ')[0] || 'bg-gray-400'}`} />
                        <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
                        <span className="font-medium">{(h.old_status as PaymentStatusDef)?.name || '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{(h.new_status as PaymentStatusDef)?.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {activeHistoryTab === 'return' && (returnHistory.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No return changes recorded</p> : (
                  <div className="space-y-3">
                    {returnHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-gray-600">{new Date(h.created_at).toLocaleString()}</span>
                        <span className="font-medium">{(h.old_status as ReturnStatusDef)?.name || '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{(h.new_status as ReturnStatusDef)?.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Manage Order — independent status controls */}
            <div className="border-t pt-4 space-y-4">
              {(() => {
                const currentOSDef = (selectedOrder as any).order_status_def as OrderStatusDef | undefined;
                const isTerminal = currentOSDef?.is_terminal === true;
                return isTerminal ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>This order is in a terminal state ({currentOSDef?.name}). The order status cannot be changed.</span>
                  </div>
                ) : null;
              })()}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Order Status</label>
                <select
                  value={newOrderStatusId}
                  onChange={(e) => setNewOrderStatusId(e.target.value)}
                  disabled={((selectedOrder as any).order_status_def as OrderStatusDef)?.is_terminal === true}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {orderStatuses.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Payment Status</label>
                <select value={newPaymentStatusId} onChange={(e) => setNewPaymentStatusId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {paymentStatuses.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Return Status</label>
                <select value={newReturnStatusId} onChange={(e) => setNewReturnStatusId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {returnStatuses.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
  <h4 className="text-sm font-semibold text-gray-900 mb-3">Delivery Details</h4>

  <div className="grid grid-cols-2 gap-4">

    {/* Courier */}
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">
        Courier
      </label>
      <input
        type="text"
        value={courierName}
        onChange={(e) => setCourierName(e.target.value)}
        placeholder="Enter courier name"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* Tracking ID */}
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">
        Tracking ID
      </label>
      <input
        type="text"
        value={trackingId}
        onChange={(e) => setTrackingId(e.target.value)}
        placeholder="Enter tracking ID"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* AWB */}
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">
        AWB
      </label>
      <input
        type="text"
        value={awbNumber}
        onChange={(e) => setAwbNumber(e.target.value)}
        placeholder="Enter AWB number"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* Expected Delivery */}
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">
        Expected Delivery
      </label>
      <input
        type="date"
        value={expectedDelivery}
        onChange={(e) => setExpectedDelivery(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>

  </div>
</div>

              <div className="flex gap-3">
                <button onClick={() => setSelectedOrder(null)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Close</button>
                <button
                  onClick={handleStatusUpdate}
                  disabled={updating || ((selectedOrder as any).order_status_def as OrderStatusDef)?.is_terminal === true && newOrderStatusId !== selectedOrder.order_status_id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
