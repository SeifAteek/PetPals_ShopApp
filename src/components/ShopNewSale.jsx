import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import PrintBillModal from './PrintBillModal';
import { createShopReceipt } from '../utils/receipts';
import {
    Search, Loader2, ShoppingBag, User, Minus, Plus, X, CreditCard,
    Banknote, CircleDollarSign, Check, AlertTriangle, Tag
} from 'lucide-react';

const getCategoryColor = (cat) => {
    const map = {
        Medicine: 'bg-blue-100 text-blue-700',
        Vaccine: 'bg-emerald-100 text-emerald-700',
        Consumable: 'bg-amber-100 text-amber-700',
        Retail: 'bg-pink-100 text-pink-700'
    };
    return map[cat] || 'bg-slate-100 text-slate-700';
};

const ShopNewSale = () => {
    const { currentSupplier, clinicId, shopProfile, addToast, triggerRefresh, checkStockAlerts, cachedProducts, productsLoading, refreshProducts } = useSupplierApp();
    const products = cachedProducts;
    const loading = productsLoading && products.length === 0;
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    // Sale state
    const [saleItems, setSaleItems] = useState([]);
    const [customerType, setCustomerType] = useState('walk-in');
    const [walkInName, setWalkInName] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [completing, setCompleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Bill modal
    const [billData, setBillData] = useState(null);
    const [showBill, setShowBill] = useState(false);

    const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);

    const filtered = useMemo(() => products.filter(p => {
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
        return matchSearch && matchCat;
    }), [products, searchQuery, categoryFilter]);

    const addToSale = (product) => {
        if (product.current_stock === 0) return;
        setSaleItems(prev => {
            const existing = prev.find(i => i.product_id === product.product_id);
            if (existing) {
                if (existing.quantity >= product.current_stock) {
                    addToast(`Only ${product.current_stock} in stock for "${product.name}".`, 'warning');
                    return prev;
                }
                return prev.map(i => i.product_id === product.product_id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setSaleItems(prev => {
            const item = prev.find(i => i.product_id === productId);
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.product_id !== productId);
            const product = products.find(p => p.product_id === productId);
            if (product && newQty > product.current_stock) {
                addToast(`Only ${product.current_stock} in stock for "${product.name}".`, 'warning');
                return prev;
            }
            return prev.map(i => i.product_id === productId ? { ...i, quantity: newQty } : i);
        });
    };

    const removeItem = (productId) => {
        setSaleItems(prev => prev.filter(i => i.product_id !== productId));
    };

    const subtotal = saleItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = Math.max(subtotal - (Number(discount) || 0), 0);

    // Customer search
    useEffect(() => {
        if (customerType !== 'registered' || customerSearch.length < 2) {
            setCustomerResults([]);
            return;
        }
        const timeout = setTimeout(async () => {
            const { data } = await supabase
                .from('profiles')
                .select('user_id, user_name, email')
                .ilike('user_name', `%${customerSearch}%`)
                .limit(5);
            setCustomerResults(data || []);
        }, 300);
        return () => clearTimeout(timeout);
    }, [customerSearch, customerType]);

    const handleCompleteSale = async () => {
        if (saleItems.length === 0) { addToast('Add items to the sale first.', 'error'); return; }
        setShowConfirm(true);
    };

    const confirmSale = async () => {
        if (completing) return;
        setCompleting(true);
        setShowConfirm(false);
        try {
            const now = new Date().toISOString();
            const clientId = customerType === 'registered' && selectedCustomer ? selectedCustomer.user_id : null;
            const guestName = clientId ? null : (walkInName.trim() || 'Walk-in');

            // 1. Insert invoice (shop-owned, NOT clinic-owned)
            const { data: invoice, error: invError } = await supabase
                .from('invoices')
                .insert({
                    shop_id: clinicId,
                    client_id: clientId,
                    guest_client_name: guestName,
                    total_amount: total,
                    status: 'Paid',
                    issue_date: now
                })
                .select().single();
            if (invError) throw invError;

            // 2. Insert order — POS sale ties order to the buyer if registered, otherwise null
            const { data: order, error: ordError } = await supabase
                .from('orders')
                .insert({
                    user_id: clientId,
                    shop_id: clinicId,
                    status: 'Delivered',
                    order_date: now,
                    total_amount: total,
                    payment_method: paymentMethod,
                    shipping_address: 'In-store'
                })
                .select().single();
            if (ordError) throw ordError;

            // 3. Insert order_items
            const orderItemsInsert = saleItems.map(item => ({
                order_id: order.order_id,
                product_id: item.product_id,
                quantity: item.quantity,
                sub_total: item.price * item.quantity
            }));
            const { error: oiError } = await supabase.from('order_items').insert(orderItemsInsert);
            if (oiError) throw oiError;

            // 4. Deduct stock from inventory_items and products (parallel per item)
            await Promise.all(saleItems.map(async (item) => {
                const updates = [];
                if (item.item_id) {
                    updates.push((async () => {
                        const { data: invItem } = await supabase.from('inventory_items')
                            .select('current_stock')
                            .eq('item_id', item.item_id)
                            .eq('clinic_id', clinicId)
                            .maybeSingle();
                        if (invItem) {
                            await supabase.from('inventory_items')
                                .update({ current_stock: Math.max(invItem.current_stock - item.quantity, 0) })
                                .eq('item_id', item.item_id)
                                .eq('clinic_id', clinicId);
                        }
                    })());
                }
                updates.push((async () => {
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
                })());
                await Promise.all(updates);
            }));

            // 5. Check stock alerts for sold items only
            const soldItemIds = saleItems.map(i => i.item_id).filter(Boolean);
            if (soldItemIds.length) {
                const { data: updatedInv } = await supabase.from('inventory_items')
                    .select('item_id, item_name, current_stock, low_stock_threshold')
                    .eq('clinic_id', clinicId)
                    .in('item_id', soldItemIds);
                if (updatedInv?.length) await checkStockAlerts(updatedInv);
            }

            // 6. Auto-save a receipt now that the sale is paid in full.
            const itemsSnapshot = {
                items: saleItems.map(i => ({
                    product_id: i.product_id,
                    name: i.name,
                    quantity: i.quantity,
                    unit_price: Number(i.price),
                    sub_total: Number(i.price) * i.quantity,
                })),
                subtotal,
                discount: Number(discount) || 0,
                total,
                channel: 'In-store',
                currency: 'EGP',
            };
            const receipt = await createShopReceipt({
                source: 'shop_pos',
                shopId: clinicId,
                invoiceId: invoice.invoice_id,
                orderId: order.order_id,
                clientId,
                guestClientName: clientId ? null : guestName,
                paymentMethod,
                paymentStatus: 'Paid',
                subtotal,
                discount: Number(discount) || 0,
                totalAmount: total,
                itemsSnapshot,
                issuedBy: currentSupplier?.user_id || null,
            });

            addToast(
                receipt
                    ? `Sale completed — Receipt ${receipt.receipt_number} saved.`
                    : `Sale completed! Total: EGP ${total.toFixed(2)}`,
                'success'
            );
            triggerRefresh();

            // 7. Open Print Bill modal
            setBillData({
                shopName: shopProfile?.name || 'PetPals Shop',
                shopLogoUrl: shopProfile?.logo_url || null,
                invoiceId: invoice.invoice_id,
                receiptNumber: receipt?.receipt_number || null,
                date: new Date().toLocaleString(),
                customerName: selectedCustomer?.user_name || (walkInName.trim() || 'Walk-in Customer'),
                customerEmail: selectedCustomer?.email || null,
                channel: 'In-store',
                items: saleItems.map(i => ({ name: i.name, qty: i.quantity, unitPrice: i.price, lineTotal: i.price * i.quantity })),
                subtotal,
                discount: Number(discount) || 0,
                total,
                paymentMethod
            });
            setShowBill(true);

            // Reset form
            setSaleItems([]);
            setCustomerType('walk-in');
            setWalkInName('');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setDiscount(0);
            setPaymentMethod('Cash');
            refreshProducts(clinicId);

        } catch (err) {
            console.error('Sale error:', err);
            addToast('Failed to complete sale: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            setCompleting(false);
        }
    };

    const nowStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--pp-text-primary, #111827)' }}>New Sale</h2>
                <p className="mt-1" style={{ color: 'var(--pp-text-muted, #6B7280)', fontSize: 14 }}>Process walk-in customer purchases.</p>
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left — Product Selector */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white text-sm" />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {categories.map(c => (
                                <button key={c} onClick={() => setCategoryFilter(c)}
                                    className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${categoryFilter === c
                                        ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[65vh] overflow-y-auto pr-1">
                        {filtered.map(product => {
                            const outOfStock = product.current_stock === 0;
                            const inSale = saleItems.find(i => i.product_id === product.product_id);
                            return (
                                <button key={product.product_id} onClick={() => addToSale(product)} disabled={outOfStock}
                                    className={`text-left p-4 rounded-2xl border transition-all group relative ${outOfStock
                                        ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                                        : inSale
                                            ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-200 shadow-sm'
                                            : 'bg-white border-slate-200 hover:border-brand-300 hover:shadow-sm cursor-pointer'}`}>
                                    <div className="flex items-start justify-between">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${getCategoryColor(product.category)}`}>
                                            <Tag className="w-2 h-2" />{product.category}
                                        </span>
                                        {inSale && <span className="bg-brand-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{inSale.quantity}</span>}
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-sm mt-2 leading-tight">{product.name}</h4>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-lg font-bold text-brand-600">EGP {Number(product.price).toFixed(2)}</span>
                                        <span className={`text-xs font-semibold ${outOfStock ? 'text-red-500' : 'text-slate-400'}`}>
                                            {outOfStock ? 'Out of stock' : `${product.current_stock} in stock`}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right — Current Sale */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft sticky top-24">
                        <div className="p-5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="w-5 h-5 text-brand-600" />
                                <h3 className="font-bold text-slate-800">New Sale</h3>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{nowStr}</p>
                        </div>

                        {/* Customer Selection */}
                        <div className="p-4 border-b border-slate-100 space-y-3">
                            <div className="flex gap-3">
                                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm font-semibold transition-all ${customerType === 'walk-in' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <input type="radio" name="custType" className="sr-only" checked={customerType === 'walk-in'} onChange={() => { setCustomerType('walk-in'); setSelectedCustomer(null); }} />
                                    <User className="w-4 h-4" /> Walk-in
                                </label>
                                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm font-semibold transition-all ${customerType === 'registered' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <input type="radio" name="custType" className="sr-only" checked={customerType === 'registered'} onChange={() => setCustomerType('registered')} />
                                    <User className="w-4 h-4" /> Registered
                                </label>
                            </div>
                            {customerType === 'walk-in' && (
                                <input type="text" placeholder="Optional: Enter customer name..." value={walkInName} onChange={e => setWalkInName(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white" />
                            )}
                            {customerType === 'registered' && (
                                <div className="relative">
                                    <input type="text" placeholder="Search customer name..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 bg-white" />
                                    {customerResults.length > 0 && !selectedCustomer && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                            {customerResults.map(c => (
                                                <button key={c.user_id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.user_name); setCustomerResults([]); }}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm">
                                                    <span className="font-semibold text-slate-800">{c.user_name}</span>
                                                    <span className="text-xs text-slate-400 ml-2">{c.email}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedCustomer && <p className="text-xs text-emerald-600 font-semibold mt-1">✓ {selectedCustomer.user_name}</p>}
                                </div>
                            )}
                        </div>

                        {/* Items list */}
                        <div className="max-h-[280px] overflow-y-auto">
                            {saleItems.length === 0 ? (
                                <div className="py-12 text-center">
                                    <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">Tap products to add them here</p>
                                </div>
                            ) : saleItems.map(item => (
                                <div key={item.product_id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                                        <p className="text-xs text-slate-400">EGP {Number(item.price).toFixed(2)} each</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQuantity(item.product_id, -1)}
                                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-8 text-center font-bold text-sm text-slate-800">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product_id, 1)}
                                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <span className="font-bold text-slate-800 text-sm w-20 text-right">EGP {(item.price * item.quantity).toFixed(2)}</span>
                                    <button onClick={() => removeItem(item.product_id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Totals & Payment */}
                        <div className="p-4 border-t border-slate-200 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-semibold text-slate-700">EGP {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Discount (EGP)</span>
                                <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                                    className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-right text-sm font-semibold focus:ring-2 focus:ring-brand-500" />
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-3">
                                <span className="text-slate-900">Total</span>
                                <span className="text-emerald-600">EGP {total.toFixed(2)}</span>
                            </div>

                            {/* Payment Method */}
                            <div className="flex gap-2 pt-1">
                                {[{ v: 'Cash', icon: Banknote }, { v: 'Card', icon: CreditCard }, { v: 'Other', icon: CircleDollarSign }].map(({ v, icon: Icon }) => (
                                    <label key={v} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all ${paymentMethod === v
                                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                        <input type="radio" name="payment" className="sr-only" checked={paymentMethod === v} onChange={() => setPaymentMethod(v)} />
                                        <Icon className="w-4 h-4" /> {v}
                                    </label>
                                ))}
                            </div>

                            <button onClick={handleCompleteSale} disabled={saleItems.length === 0 || completing}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
                                Complete Sale — EGP {total.toFixed(2)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-soft w-full max-w-sm p-6 text-center">
                        <ShoppingBag className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Complete this sale?</h3>
                        <p className="text-slate-500 text-sm mb-1">{saleItems.length} item{saleItems.length > 1 ? 's' : ''} • {paymentMethod}</p>
                        <p className="text-2xl font-bold text-emerald-600 mb-6">EGP {total.toFixed(2)}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} disabled={completing}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
                            <button onClick={confirmSale} disabled={completing}
                                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                                {completing && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Bill Modal */}
            <PrintBillModal isOpen={showBill} onClose={() => setShowBill(false)} billData={billData} />
        </div>
    );
};

export default ShopNewSale;
