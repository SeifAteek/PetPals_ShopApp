import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    Search, Loader2, AlertTriangle, CheckCircle2, Package, Plus,
    Edit2, Check, Trash2, X, Coins, Tag
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

const getStatus = (stock, threshold) => {
    if (stock === 0) return 'Out of stock';
    if (stock < threshold / 2) return 'Critical';
    if (stock < threshold) return 'Low';
    return 'Healthy';
};

const getStatusConfig = (status) => {
    switch (status) {
        case 'Out of stock': return { classes: 'bg-red-100 text-red-700', barColor: 'bg-red-500', rowBg: 'bg-red-50/40' };
        case 'Critical': return { classes: 'bg-red-50 text-red-600', barColor: 'bg-red-500', rowBg: 'bg-red-50/30' };
        case 'Low': return { classes: 'bg-amber-50 text-amber-600', barColor: 'bg-amber-500', rowBg: 'bg-amber-50/30' };
        default: return { classes: 'bg-emerald-50 text-emerald-600', barColor: 'bg-emerald-500', rowBg: '' };
    }
};

const ShopProducts = () => {
    const { clinicId, addToast, triggerRefresh, cachedProducts, productsLoading, refreshProducts } = useSupplierApp();
    const [patches, setPatches] = useState({});
    const products = useMemo(
        () => cachedProducts.map(p => (patches[p.product_id] ? { ...p, ...patches[p.product_id] } : p)),
        [cachedProducts, patches]
    );
    const loading = productsLoading && products.length === 0;
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saveConfirm, setSaveConfirm] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [formData, setFormData] = useState({ name: '', category: 'Medicine', price: '', costPrice: '', initialStock: '', threshold: '10' });
    const [formSaving, setFormSaving] = useState(false);

    useEffect(() => { setPatches({}); }, [cachedProducts]);

    const handleInlineEdit = async (product, field, newVal) => {
        const val = parseInt(newVal, 10);
        if (isNaN(val) || val < 0) { setEditingCell(null); return; }
        setEditingCell(null);

        setPatches(prev => ({ ...prev, [product.product_id]: { ...prev[product.product_id], [field]: val } }));
        setSaveConfirm(product.product_id);
        setTimeout(() => setSaveConfirm(null), 2000);

        try {
            if (field === 'current_stock') {
                if (product.item_id) {
                    await supabase.from('inventory_items')
                        .update({ current_stock: val })
                        .eq('item_id', product.item_id)
                        .eq('clinic_id', clinicId);
                }
                await supabase.from('products')
                    .update({ stock_level: val })
                    .eq('product_id', product.product_id)
                    .eq('shop_id', clinicId);
            } else if (field === 'low_stock_threshold') {
                if (product.item_id) {
                    await supabase.from('inventory_items')
                        .update({ low_stock_threshold: val })
                        .eq('item_id', product.item_id)
                        .eq('clinic_id', clinicId);
                }
            }
            triggerRefresh();
            refreshProducts(clinicId);
        } catch (err) {
            console.error('Error updating:', err);
            addToast('Failed to update. Please try again.', 'error');
            setPatches(prev => {
                const next = { ...prev };
                delete next[product.product_id];
                return next;
            });
            refreshProducts(clinicId);
        }
    };

    const openAddModal = () => {
        setEditProduct(null);
        setFormData({ name: '', category: 'Medicine', price: '', costPrice: '', initialStock: '', threshold: '10' });
        setShowModal(true);
    };

    const openEditModal = (product) => {
        setEditProduct(product);
        setFormData({
            name: product.name,
            category: product.category || 'Retail',
            price: String(product.price),
            costPrice: String(product.unit_price || product.price),
            initialStock: String(product.current_stock),
            threshold: String(product.low_stock_threshold),
            image_url: product.image_url || ''
        });
        setShowModal(true);
    };

    const handleSaveProduct = async () => {
        const { name, category, price, costPrice, initialStock, threshold, image_url } = formData;
        if (!name || !price || !costPrice || !initialStock || !threshold) {
            addToast('Please fill in all fields.', 'error');
            return;
        }

        setFormSaving(true);
        try {
            if (editProduct) {
                await supabase.from('products').update({
                    name, price: parseFloat(price), stock_level: parseInt(initialStock, 10), category, image_url: image_url || null
                }).eq('product_id', editProduct.product_id).eq('shop_id', clinicId);

                if (editProduct.item_id) {
                    await supabase.from('inventory_items').update({
                        item_name: name, category,
                        current_stock: parseInt(initialStock, 10),
                        low_stock_threshold: parseInt(threshold, 10),
                        unit_price: parseFloat(costPrice)
                    }).eq('item_id', editProduct.item_id).eq('clinic_id', clinicId);
                }
                addToast(`Product "${name}" updated successfully.`, 'success');
            } else {
                // INSERT new
                const { data: product } = await supabase
                    .from('products')
                    .insert({ name, price: parseFloat(price), stock_level: parseInt(initialStock, 10), category, shop_id: clinicId, image_url: image_url || null })
                    .select().single();

                await supabase.from('inventory_items').insert({
                    clinic_id: clinicId,
                    item_name: name, category,
                    current_stock: parseInt(initialStock, 10),
                    low_stock_threshold: parseInt(threshold, 10),
                    unit_price: parseFloat(costPrice),
                    last_restocked: new Date().toISOString()
                });
                addToast(`Product "${name}" added successfully.`, 'success');
            }
            setShowModal(false);
            refreshProducts(clinicId);
            triggerRefresh();
        } catch (err) {
            console.error('Error saving product:', err);
            addToast('Failed to save product: ' + err.message, 'error');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteProduct = async (product) => {
        if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
        try {
            await supabase.from('products').delete()
                .eq('product_id', product.product_id)
                .eq('shop_id', clinicId);
            if (product.item_id) {
                await supabase.from('inventory_items').delete()
                    .eq('item_id', product.item_id)
                    .eq('clinic_id', clinicId);
            }
            addToast(`Product "${product.name}" deleted.`, 'success');
            refreshProducts(clinicId);
            triggerRefresh();
        } catch (err) {
            console.error('Error deleting:', err);
            addToast('Failed to delete product.', 'error');
        }
    };

    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    const stats = products.reduce((acc, item) => {
        acc.total++;
        const s = getStatus(item.current_stock, item.low_stock_threshold);
        if (s === 'Out of stock') acc.outOfStock++;
        else if (s === 'Critical' || s === 'Low') acc.low++;
        acc.stockValue += (item.current_stock || 0) * (item.unit_price || 0);
        return acc;
    }, { total: 0, low: 0, outOfStock: 0, stockValue: 0 });

    const filtered = products.filter(item => {
        const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
        const status = getStatus(item.current_stock, item.low_stock_threshold);
        const matchStatus = statusFilter === 'All' ||
            (statusFilter === 'Low' && status === 'Low') ||
            (statusFilter === 'Critical' && status === 'Critical') ||
            (statusFilter === 'Out of Stock' && status === 'Out of stock') ||
            (statusFilter === 'Healthy' && status === 'Healthy');
        return matchSearch && matchCat && matchStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--pp-text-primary, #111827)' }}>My Products</h2>
                <p className="mt-1" style={{ color: 'var(--pp-text-muted, #6B7280)', fontSize: 14 }}>Manage your product catalog and stock levels.</p>
            </div>
            <button
                onClick={openAddModal}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    background: 'var(--pp-primary, #2E7D32)',
                    color: '#ffffff',
                    borderRadius: 12, border: 'none',
                    fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(46,125,50,0.25)',
                    transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--pp-primary-deep, #1B5E20)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--pp-primary, #2E7D32)'}
            >
                <Plus style={{ width: 16, height: 16 }} /> Add Product
            </button>

            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-slate-50"><Package className="w-5 h-5 text-slate-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-soft">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50"><Coins className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Stock Value</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {stats.stockValue.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-soft">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-amber-50"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Low Stock</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.low}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-soft">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-red-50"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Out of Stock</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.outOfStock}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700">
                    {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700">
                    <option value="All">All Statuses</option>
                    <option value="Healthy">Healthy</option>
                    <option value="Low">Low</option>
                    <option value="Critical">Critical</option>
                    <option value="Out of Stock">Out of Stock</option>
                </select>
            </div>

            {/* Products Table */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 border-dashed">
                    <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-800">No products found</h3>
                    <p className="text-slate-500 mt-2">Try adjusting your filters or add a new product.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                    <th className="px-5 py-4">Product</th>
                                    <th className="px-5 py-4">Category</th>
                                    <th className="px-5 py-4 text-center">Stock</th>
                                    <th className="px-5 py-4 text-center">Threshold</th>
                                    <th className="px-5 py-4 text-right">Cost</th>
                                    <th className="px-5 py-4 text-right">Sell Price</th>
                                    <th className="px-5 py-4 text-right">Stock Value</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(item => {
                                    const status = getStatus(item.current_stock, item.low_stock_threshold);
                                    const cfg = getStatusConfig(status);
                                    const barWidth = Math.min((item.current_stock / (item.low_stock_threshold * 2)) * 100, 100);
                                    const isEditingStock = editingCell?.id === item.product_id && editingCell?.field === 'current_stock';
                                    const isEditingThreshold = editingCell?.id === item.product_id && editingCell?.field === 'low_stock_threshold';
                                    const stockValue = (item.current_stock || 0) * (item.unit_price || 0);

                                    return (
                                        <tr key={item.product_id} className={`hover:bg-slate-50/80 transition-colors ${cfg.rowBg}`}>
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getCategoryColor(item.category)}`}>
                                                    <Tag className="w-2.5 h-2.5" />{item.category}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {isEditingStock ? (
                                                    <input type="number" autoFocus value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={() => handleInlineEdit(item, 'current_stock', editValue)}
                                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }}
                                                        className="w-20 px-2 py-1 text-sm font-bold border-2 border-brand-500 rounded-lg text-center" />
                                                ) : (
                                                    <div className="cursor-pointer group inline-block"
                                                        onClick={() => { setEditingCell({ id: item.product_id, field: 'current_stock' }); setEditValue(String(item.current_stock)); }}>
                                                        <span className="font-bold text-slate-800 group-hover:text-brand-600 text-sm">{item.current_stock}</span>
                                                        <Edit2 className="w-3 h-3 text-slate-300 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1 mx-auto overflow-hidden">
                                                            <div className={`h-full rounded-full ${cfg.barColor}`} style={{ width: barWidth + '%' }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {isEditingThreshold ? (
                                                    <input type="number" autoFocus value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={() => handleInlineEdit(item, 'low_stock_threshold', editValue)}
                                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCell(null); }}
                                                        className="w-20 px-2 py-1 text-sm font-bold border-2 border-brand-500 rounded-lg text-center" />
                                                ) : (
                                                    <div className="cursor-pointer group inline-block"
                                                        onClick={() => { setEditingCell({ id: item.product_id, field: 'low_stock_threshold' }); setEditValue(String(item.low_stock_threshold)); }}>
                                                        <span className="text-slate-500 font-medium text-sm group-hover:text-brand-600">{item.low_stock_threshold}</span>
                                                        <Edit2 className="w-3 h-3 text-slate-300 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-sm text-slate-600">EGP {Number(item.unit_price).toFixed(2)}</td>
                                            <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-700">EGP {Number(item.price).toFixed(2)}</td>
                                            <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-800">EGP {stockValue.toFixed(2)}</td>
                                            <td className="px-5 py-3.5">
                                                {saveConfirm === item.product_id ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs"><Check className="w-3 h-3" /> Saved ✓</span>
                                                ) : (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.classes}`}>{status}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteProduct(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Product Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-soft w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">{editProduct ? 'Edit Product' : 'Add Product'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-1">Product Name</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" placeholder="e.g. Rabies Vaccine 5ml" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-1">Category</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white">
                                    <option value="Vaccine">Vaccine</option>
                                    <option value="Medicine">Medicine</option>
                                    <option value="Consumable">Consumable</option>
                                    <option value="Retail">Retail</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-1">Product Photo</label>
                                <div className="flex items-center gap-3">
                                    {formData.image_url && <img src={formData.image_url} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />}
                                    <input type="file" accept="image/*" onChange={e => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => setFormData({ ...formData, image_url: reader.result });
                                            reader.readAsDataURL(file);
                                        }
                                    }} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-1">Selling Price (EGP)</label>
                                    <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-1">Cost Price (EGP)</label>
                                    <input type="number" step="0.01" value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white" placeholder="0.00" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-1">Initial Stock Qty</label>
                                    <input type="number" value={formData.initialStock} onChange={e => setFormData({ ...formData, initialStock: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-1">Low Stock Threshold</label>
                                    <input type="number" value={formData.threshold} onChange={e => setFormData({ ...formData, threshold: e.target.value })}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white" placeholder="10" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center gap-3 justify-end">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold text-sm hover:text-slate-800 transition-colors">Cancel</button>
                            <button onClick={handleSaveProduct} disabled={formSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                                {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {editProduct ? 'Save Changes' : 'Add Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopProducts;
