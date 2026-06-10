import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    Loader2, Search, Package, Plus, Check, Calendar, DollarSign,
    TrendingDown, FileText, ArrowDownToLine
} from 'lucide-react';

const ShopRestocking = () => {
    const { currentSupplier, clinicId, addToast, triggerRefresh } = useSupplierApp();
    const [products, setProducts] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [form, setForm] = useState({
        productId: '',
        productName: '',
        quantity: '',
        costPerUnit: '',
        supplierName: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    useEffect(() => { if (clinicId) fetchData(); }, [clinicId]);

    const fetchData = async () => {
        if (!clinicId) return;
        try {
            setLoading(true);
            const { data: prods } = await supabase.from('products')
                .select('product_id, name, stock_level, category')
                .eq('shop_id', clinicId)
                .order('name');
            setProducts(prods || []);

            const { data: exp } = await supabase
                .from('clinic_expenses')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('category', 'Inventory Restock')
                .order('expense_date', { ascending: false });
            setExpenses(exp || []);
        } catch (err) {
            addToast('Failed to load data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totalCost = (Number(form.quantity) || 0) * (Number(form.costPerUnit) || 0);

    const filteredProducts = products.filter(p =>
        !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const selectProduct = (p) => {
        setForm({ ...form, productId: p.product_id, productName: p.name });
        setProductSearch(p.name);
        setShowProductDropdown(false);
    };

    const handleSubmit = async () => {
        if (!form.productId || !form.quantity || !form.costPerUnit) {
            addToast('Please fill in product, quantity, and cost per unit.', 'error');
            return;
        }
        const qty = parseInt(form.quantity, 10);
        const cpu = parseFloat(form.costPerUnit);
        const total = qty * cpu;

        if (isNaN(qty) || qty <= 0 || isNaN(cpu) || cpu <= 0) {
            addToast('Invalid quantity or cost values.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const description = `Restock: ${form.productName} x${qty} from ${form.supplierName || 'Unknown supplier'}. ${form.notes || ''}`.trim();

            // 1. Insert expense
            const { error: expError } = await supabase.from('clinic_expenses').insert({
                clinic_id: clinicId,
                category: 'Inventory Restock',
                description,
                amount: total,
                expense_date: form.date
            });
            if (expError) throw expError;

            // 2. Update inventory_items (scoped to current shop)
            const { data: invItem } = await supabase
                .from('inventory_items')
                .select('item_id, current_stock')
                .eq('item_name', form.productName)
                .eq('clinic_id', clinicId)
                .maybeSingle();
            if (invItem) {
                await supabase.from('inventory_items').update({
                    current_stock: invItem.current_stock + qty,
                    last_restocked: form.date
                }).eq('item_id', invItem.item_id).eq('clinic_id', clinicId);
            }

            // 3. Update products.stock_level
            const { data: prod } = await supabase.from('products')
                .select('stock_level')
                .eq('product_id', form.productId)
                .eq('shop_id', clinicId)
                .maybeSingle();
            if (prod) {
                await supabase.from('products')
                    .update({ stock_level: prod.stock_level + qty })
                    .eq('product_id', form.productId)
                    .eq('shop_id', clinicId);
            }

            const newStock = (invItem ? invItem.current_stock : (prod?.stock_level || 0)) + qty;
            addToast(`Restock logged. ${form.productName} stock updated to ${newStock}.`, 'success');
            triggerRefresh();

            // Reset form
            setForm({ productId: '', productName: '', quantity: '', costPerUnit: '', supplierName: '', date: new Date().toISOString().split('T')[0], notes: '' });
            setProductSearch('');
            fetchData();
        } catch (err) {
            console.error('Restock error:', err);
            addToast('Failed to log restock: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Parse restock data from description
    const parseRestockDescription = (desc) => {
        // Format: "Restock: [productName] x[qty] from [supplier]. [notes]"
        const match = desc?.match(/^Restock: (.+?) x(\d+) from (.+?)\.(.*)$/);
        if (match) return { product: match[1], qty: parseInt(match[2]), supplier: match[3].trim(), notes: match[4]?.trim() };
        return { product: desc, qty: 0, supplier: '—', notes: '' };
    };

    // This month's total
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonthTotal = expenses
        .filter(e => e.expense_date >= monthStart)
        .reduce((s, e) => s + Number(e.amount), 0);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Restocking (Expenses Log)</h2>
                <p className="text-slate-500 mt-1">Log inventory purchases and track restocking costs.</p>
            </div>

            {/* Section A — Log a Restock */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                    <ArrowDownToLine className="w-5 h-5 text-brand-500" />
                    <h3 className="font-bold text-slate-800">Log a Restock</h3>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Product selector */}
                        <div className="relative">
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Product *</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Search product..." value={productSearch}
                                    onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); setForm({ ...form, productId: '', productName: '' }); }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white text-sm" />
                            </div>
                            {showProductDropdown && filteredProducts.length > 0 && !form.productId && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <button key={p.product_id} onClick={() => selectProduct(p)}
                                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm flex justify-between">
                                            <span className="font-semibold text-slate-800">{p.name}</span>
                                            <span className="text-xs text-slate-400">{p.category}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {form.productId && <p className="text-xs text-emerald-600 font-semibold mt-1">✓ {form.productName}</p>}
                        </div>

                        {/* Supplier name */}
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Supplier Name</label>
                            <input type="text" placeholder="e.g. MedVet Supplies" value={form.supplierName}
                                onChange={e => setForm({ ...form, supplierName: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Quantity *</label>
                            <input type="number" min="1" placeholder="0" value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Cost per unit (EGP) *</label>
                            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.costPerUnit}
                                onChange={e => setForm({ ...form, costPerUnit: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Total Cost</label>
                            <div className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 text-sm font-bold text-emerald-700">
                                EGP {totalCost.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Date</label>
                            <input type="date" value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Notes (optional)</label>
                        <textarea rows={2} placeholder="Additional notes about this restock..." value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm resize-none" />
                    </div>

                    <button onClick={handleSubmit} disabled={submitting}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Log Restock
                    </button>
                </div>
            </div>

            {/* Section B — Restock History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-tangerine-500" />
                        <h3 className="font-bold text-slate-800">Restock History</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">This Month's Total</p>
                        <p className="text-lg font-bold text-red-600">EGP {thisMonthTotal.toFixed(2)}</p>
                    </div>
                </div>
                {expenses.length === 0 ? (
                    <div className="py-12 text-center">
                        <Package className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No restocks logged yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                    <th className="px-5 py-4">Date</th>
                                    <th className="px-5 py-4">Product</th>
                                    <th className="px-5 py-4 text-center">Qty</th>
                                    <th className="px-5 py-4 text-right">Cost/Unit</th>
                                    <th className="px-5 py-4 text-right">Total Cost</th>
                                    <th className="px-5 py-4">Supplier</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map(exp => {
                                    const parsed = parseRestockDescription(exp.description);
                                    const costPerUnit = parsed.qty > 0 ? (Number(exp.amount) / parsed.qty) : 0;
                                    return (
                                        <tr key={exp.expense_id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-5 py-3.5 text-sm text-slate-500">
                                                {new Date(exp.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm font-bold text-slate-800">{parsed.product}</td>
                                            <td className="px-5 py-3.5 text-sm text-center text-slate-600">{parsed.qty || '—'}</td>
                                            <td className="px-5 py-3.5 text-sm text-right text-slate-600">EGP {costPerUnit.toFixed(2)}</td>
                                            <td className="px-5 py-3.5 text-sm text-right font-bold text-red-600">EGP {Number(exp.amount).toFixed(2)}</td>
                                            <td className="px-5 py-3.5 text-sm text-slate-500">{parsed.supplier}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopRestocking;
