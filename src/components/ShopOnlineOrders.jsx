import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import PrintBillModal from './PrintBillModal';
import { createShopReceipt } from '../utils/receipts';
import {
    Loader2, Search, Package, X, CheckCircle2, Truck, Ban,
    Calendar, Eye, Printer, Clock, ChevronDown
} from 'lucide-react';

const getRelativeTime = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return diff + ' min ago';
    if (diff < 1440) return Math.floor(diff / 60) + ' hr ago';
    return Math.floor(diff / 1440) + ' days ago';
};

const statusConfig = {
    Processing: { classes: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    Shipped: { classes: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
    Delivered: { classes: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    Cancelled: { classes: 'bg-red-100 text-red-700', dot: 'bg-red-500' }
};

const ShopOnlineOrders = () => {
    const { currentSupplier, clinicId, shopProfile, addToast, triggerRefresh, checkStockAlerts } = useSupplierApp();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [orderCustomer, setOrderCustomer] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Bill modal
    const [billData, setBillData] = useState(null);
    const [showBill, setShowBill] = useState(false);

    useEffect(() => { if (clinicId) fetchOrders(); }, [clinicId]);

    const fetchOrders = async () => {
        if (!clinicId) return;
        try {
            setLoading(true);
            // Filter orders by shop_id (requires `orders.shop_id` migration).
            const { data } = await supabase
                .from('orders')
                .select('*, profiles:user_id(user_name, email, phone_number), order_items(order_item_id)')
                .eq('shop_id', clinicId)
                .order('order_date', { ascending: false });
            setOrders(data || []);
        } catch (err) {
            addToast('Failed to load orders.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const openOrderDetail = async (order) => {
        setSelectedOrder(order);
        setDetailLoading(true);
        try {
            const { data: items } = await supabase
                .from('order_items')
                .select('*, products:product_id(name, price, category)')
                .eq('order_id', order.order_id);
            setOrderItems(items || []);

            if (order.user_id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('user_name, email, phone_number')
                    .eq('user_id', order.user_id)
                    .single();
                setOrderCustomer(profile);
            } else {
                setOrderCustomer(null);
            }
        } catch (err) {
            addToast('Failed to load order details.', 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const updateOrderStatus = async (newStatus) => {
        if (!selectedOrder) return;
        const confirmMsg = {
            'Shipped': 'Mark this order as shipped?',
            'Delivered': 'Mark as delivered? This will deduct stock and generate an invoice.',
            'Cancelled': 'Cancel this order? This cannot be undone.'
        };
        if (!window.confirm(confirmMsg[newStatus] || `Update status to ${newStatus}?`)) return;

        setActionLoading(true);
        try {
            const { error: updateError } = await supabase.from('orders')
                .update({ status: newStatus })
                .eq('order_id', selectedOrder.order_id)
                .eq('shop_id', clinicId);
            if (updateError) throw updateError;

            if (newStatus === 'Delivered') {
                for (const item of orderItems) {
                    if (item.product_id) {
                        const { data: prod } = await supabase.from('products')
                            .select('stock_level')
                            .eq('product_id', item.product_id)
                            .eq('shop_id', clinicId)
                            .maybeSingle();
                        if (prod) {
                            await supabase.from('products')
                                .update({ stock_level: Math.max(prod.stock_level - item.quantity, 0) })
                                .eq('product_id', item.product_id)
                                .eq('shop_id', clinicId);
                        }
                        // Find matching inventory item — scoped to current shop to avoid name-collision leaks
                        const productName = item.products?.name;
                        if (productName) {
                            const { data: inv } = await supabase.from('inventory_items')
                                .select('item_id, current_stock')
                                .eq('item_name', productName)
                                .eq('clinic_id', clinicId)
                                .maybeSingle();
                            if (inv) {
                                await supabase.from('inventory_items')
                                    .update({ current_stock: Math.max(inv.current_stock - item.quantity, 0) })
                                    .eq('item_id', inv.item_id)
                                    .eq('clinic_id', clinicId);
                            }
                        }
                    }
                }
                const { data: deliveredInvoice } = await supabase.from('invoices').insert({
                    shop_id: clinicId,
                    client_id: selectedOrder.user_id,
                    guest_client_name: selectedOrder.profiles?.user_name || 'Online Customer',
                    total_amount: selectedOrder.total_amount,
                    status: 'Paid',
                    issue_date: new Date().toISOString()
                }).select().single();

                const { data: updatedInv } = await supabase.from('inventory_items').select('*').eq('clinic_id', clinicId);
                if (updatedInv) {
                    const soldNames = orderItems.map(i => i.products?.name).filter(Boolean);
                    const alertItems = updatedInv.filter(i => soldNames.includes(i.item_name));
                    await checkStockAlerts(alertItems);
                }

                // Auto-save receipt + prompt the shop owner to download/print
                const itemsSnapshot = {
                    items: orderItems.map(i => ({
                        product_id: i.product_id,
                        name: i.products?.name || 'Product',
                        quantity: i.quantity,
                        unit_price: Number(i.products?.price ?? (i.sub_total / Math.max(i.quantity, 1))),
                        sub_total: Number(i.sub_total),
                    })),
                    shipping_address: selectedOrder.shipping_address,
                    channel: 'Online',
                    currency: 'EGP',
                    total: Number(selectedOrder.total_amount),
                };
                const receipt = await createShopReceipt({
                    source: 'shop_online_order',
                    shopId: clinicId,
                    invoiceId: deliveredInvoice?.invoice_id || null,
                    orderId: selectedOrder.order_id,
                    clientId: selectedOrder.user_id || null,
                    guestClientName: selectedOrder.user_id ? null : (selectedOrder.guest_client_name || 'Online Customer'),
                    paymentMethod: selectedOrder.payment_method || 'Online',
                    paymentStatus: 'Paid',
                    subtotal: Number(selectedOrder.total_amount),
                    discount: 0,
                    totalAmount: Number(selectedOrder.total_amount),
                    itemsSnapshot,
                    issuedBy: currentSupplier?.user_id || null,
                });

                addToast(
                    receipt
                        ? `Order delivered — Receipt ${receipt.receipt_number} saved.`
                        : `Order delivered successfully.`,
                    'success'
                );
                triggerRefresh();
                setSelectedOrder({ ...selectedOrder, status: newStatus });
                fetchOrders();

                // Prompt the user to print/download the receipt
                const custName = orderCustomer?.user_name || selectedOrder.profiles?.user_name || selectedOrder.guest_client_name || 'Customer';
                setBillData({
                    shopName: shopProfile?.name || 'PetPals Shop',
                    shopLogoUrl: shopProfile?.logo_url || null,
                    invoiceId: deliveredInvoice?.invoice_id || selectedOrder.order_id,
                    receiptNumber: receipt?.receipt_number || null,
                    date: new Date().toLocaleString(),
                    customerName: custName,
                    customerEmail: orderCustomer?.email || null,
                    channel: 'Online',
                    items: orderItems.map(i => ({
                        name: i.products?.name || 'Product',
                        qty: i.quantity,
                        unitPrice: Number(i.products?.price ?? (i.sub_total / Math.max(i.quantity, 1))),
                        lineTotal: Number(i.sub_total),
                    })),
                    subtotal: Number(selectedOrder.total_amount),
                    discount: 0,
                    total: Number(selectedOrder.total_amount),
                    paymentMethod: selectedOrder.payment_method || 'Online'
                });
                setShowBill(true);
                return;
            }

            addToast(`Order ${newStatus.toLowerCase()} successfully.`, 'success');
            triggerRefresh();
            setSelectedOrder({ ...selectedOrder, status: newStatus });
            fetchOrders();
        } catch (err) {
            console.error('Status update error:', err);
            addToast('Failed to update order status.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const openBillForOrder = () => {
        if (!selectedOrder) return;
        const custName = orderCustomer?.user_name || selectedOrder.profiles?.user_name || selectedOrder.guest_client_name || 'Customer';
        const isInStore = selectedOrder.shipping_address === 'In-store';
        setBillData({
            shopName: shopProfile?.name || 'PetPals Shop',
            shopLogoUrl: shopProfile?.logo_url || null,
            invoiceId: selectedOrder.order_id,
            date: new Date(selectedOrder.order_date).toLocaleString(),
            customerName: custName,
            customerEmail: orderCustomer?.email || null,
            channel: isInStore ? 'In-store' : 'Online',
            items: orderItems.map(i => ({
                name: i.products?.name || 'Product',
                qty: i.quantity,
                unitPrice: i.products?.price || (i.sub_total / i.quantity),
                lineTotal: i.sub_total
            })),
            subtotal: Number(selectedOrder.total_amount),
            discount: 0,
            total: Number(selectedOrder.total_amount),
            paymentMethod: selectedOrder.payment_method || 'Online'
        });
        setShowBill(true);
    };

    const filtered = orders.filter(o => {
        const matchStatus = statusFilter === 'All' || o.status === statusFilter;
        const custName = o.profiles?.user_name || o.guest_client_name || '';
        const matchSearch = !searchQuery || custName.toLowerCase().includes(searchQuery.toLowerCase()) || o.order_id.includes(searchQuery);
        return matchStatus && matchSearch;
    });

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Online Orders</h2>
                <p className="text-slate-500 mt-1">Manage orders placed by customers remotely.</p>
            </div>

            {/* Filter bar */}
            <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Search by customer or order ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white text-sm" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 text-sm">
                    <option value="All">All Statuses</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>

            {/* Orders Table */}
            {filtered.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 border-dashed">
                    <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-800">No orders found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your filters.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                    <th className="px-5 py-4">Order ID</th>
                                    <th className="px-5 py-4">Customer</th>
                                    <th className="px-5 py-4 text-center">Items</th>
                                    <th className="px-5 py-4 text-right">Total</th>
                                    <th className="px-5 py-4">Date</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Shipping</th>
                                    <th className="px-5 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(order => {
                                    const cfg = statusConfig[order.status] || statusConfig.Processing;
                                    const custName = order.profiles?.user_name || order.guest_client_name || 'Customer';
                                    return (
                                        <tr key={order.order_id} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => openOrderDetail(order)}>
                                            <td className="px-5 py-3.5 text-sm font-bold text-slate-800">#{(order.order_id || '').slice(0, 8)}</td>
                                            <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{custName}</td>
                                            <td className="px-5 py-3.5 text-sm text-center text-slate-600">{order.order_items?.length || 0}</td>
                                            <td className="px-5 py-3.5 text-sm font-bold text-slate-900 text-right">EGP {Number(order.total_amount).toFixed(2)}</td>
                                            <td className="px-5 py-3.5 text-sm text-slate-500" title={new Date(order.order_date).toLocaleString()}>{getRelativeTime(order.order_date)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.classes}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></div>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[120px] truncate">{order.shipping_address || '—'}</td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-2xl shadow-soft w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Order #{(selectedOrder.order_id || '').slice(0, 8)}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {new Date(selectedOrder.order_date).toLocaleString()} •{' '}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${(statusConfig[selectedOrder.status] || {}).classes}`}>
                                        {selectedOrder.status}
                                    </span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>

                        {detailLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
                        ) : (
                            <div className="p-5 space-y-5">
                                {/* Customer info */}
                                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</h4>
                                    <p className="text-sm font-semibold text-slate-800">{orderCustomer?.user_name || selectedOrder.profiles?.user_name || selectedOrder.guest_client_name || 'Customer'}</p>
                                    {orderCustomer?.email && <p className="text-xs text-slate-500">{orderCustomer.email}</p>}
                                    {orderCustomer?.phone_number && <p className="text-xs text-slate-500">{orderCustomer.phone_number}</p>}
                                    {selectedOrder.shipping_address && <p className="text-xs text-slate-500">Shipping: {selectedOrder.shipping_address}</p>}
                                </div>

                                {/* Items table */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Items</h4>
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead><tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase">
                                                <th className="px-4 py-3">Product</th>
                                                <th className="px-4 py-3 text-center">Qty</th>
                                                <th className="px-4 py-3 text-right">Price</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {orderItems.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{item.products?.name || 'Product'}</td>
                                                        <td className="px-4 py-3 text-sm text-center text-slate-600">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-sm text-right text-slate-600">EGP {Number(item.products?.price || (item.sub_total / item.quantity)).toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-sm text-right font-bold text-slate-800">EGP {Number(item.sub_total).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Order summary */}
                                <div className="flex justify-end">
                                    <div className="w-56 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Total</span>
                                            <span className="font-bold text-emerald-600 text-lg">EGP {Number(selectedOrder.total_amount).toFixed(2)}</span>
                                        </div>
                                        {selectedOrder.payment_method && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-500">Payment</span>
                                                <span className="font-semibold text-slate-700">{selectedOrder.payment_method}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3 border-t border-slate-100 pt-4">
                                    {selectedOrder.status === 'Processing' && (
                                        <>
                                            <button onClick={() => updateOrderStatus('Shipped')} disabled={actionLoading}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                                                <Truck className="w-4 h-4" /> Mark as Shipped
                                            </button>
                                            <button onClick={() => updateOrderStatus('Cancelled')} disabled={actionLoading}
                                                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                                                <Ban className="w-4 h-4" /> Cancel
                                            </button>
                                        </>
                                    )}
                                    {selectedOrder.status === 'Shipped' && (
                                        <button onClick={() => updateOrderStatus('Delivered')} disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                                            <CheckCircle2 className="w-4 h-4" /> Mark as Delivered
                                        </button>
                                    )}
                                    {selectedOrder.status === 'Delivered' && (
                                        <button onClick={openBillForOrder}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors">
                                            <Printer className="w-4 h-4" /> Print Bill
                                        </button>
                                    )}
                                    {actionLoading && <Loader2 className="w-5 h-5 animate-spin text-brand-500" />}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Print Bill Modal */}
            <PrintBillModal isOpen={showBill} onClose={() => setShowBill(false)} billData={billData} />
        </div>
    );
};

export default ShopOnlineOrders;
