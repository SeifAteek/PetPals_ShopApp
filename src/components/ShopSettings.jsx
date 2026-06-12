import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    User, Save, Loader2, Bell, AlertTriangle, ShieldAlert, Package, Sliders
} from 'lucide-react';

const ShopSettings = () => {
    const { currentSupplier, clinicId, shopProfile, addToast } = useSupplierApp();
    const [profileData, setProfileData] = useState({ shopName: '', ownerName: '', email: '', phone_number: '' });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileFeedback, setProfileFeedback] = useState('');

    const [inventory, setInventory] = useState([]);
    const [origThresholds, setOrigThresholds] = useState({});
    const [invLoading, setInvLoading] = useState(true);
    const [thresholdSaving, setThresholdSaving] = useState(false);
    const [thresholdFeedback, setThresholdFeedback] = useState('');

    const [globalThreshold, setGlobalThreshold] = useState('');

    const [notifications, setNotifications] = useState({
        newOnlineOrder: true,
        lowStock: true,
        outOfStock: true,
        restockLogged: true
    });

    useEffect(() => {
        if (!currentSupplier) return;
        setProfileData({
            shopName: shopProfile?.name || '',
            ownerName: currentSupplier.user_name || '',
            email: currentSupplier.email || '',
            phone_number: currentSupplier.phone_number || ''
        });

        const stored = localStorage.getItem('shop_notif_' + currentSupplier.user_id);
        if (stored) try { setNotifications(JSON.parse(stored)); } catch (e) { }

        const gt = localStorage.getItem('shop_global_threshold_' + currentSupplier.user_id);
        if (gt) setGlobalThreshold(gt);

        if (clinicId) fetchInventory();
    }, [currentSupplier, clinicId]);

    const fetchInventory = async () => {
        if (!clinicId) return;
        setInvLoading(true);
        try {
            const { data } = await supabase
                .from('inventory_items')
                .select('item_id, item_name, current_stock, low_stock_threshold')
                .eq('clinic_id', clinicId)
                .order('item_name');
            const orig = {};
            (data || []).forEach(i => { orig[i.item_id] = i.low_stock_threshold; });
            setOrigThresholds(orig);
            setInventory(data || []);
        } catch (err) {
            console.error(err);
            addToast('Failed to load inventory.', 'error');
        } finally {
            setInvLoading(false);
        }
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileFeedback('');
        try {
            const { error: profileError } = await supabase.from('profiles').update({
                user_name: profileData.ownerName,
                email: profileData.email,
                phone_number: profileData.phone_number
            }).eq('user_id', currentSupplier.user_id);
            if (profileError) throw profileError;

            if (clinicId && profileData.shopName?.trim()) {
                const { error: shopError } = await supabase.from('shops')
                    .update({ name: profileData.shopName.trim() })
                    .eq('shop_id', clinicId)
                    .eq('owner_id', currentSupplier.user_id);
                if (shopError) throw shopError;
            }

            setProfileFeedback('success');
            addToast('Profile updated successfully.', 'success');
            setTimeout(() => setProfileFeedback(''), 3000);
        } catch (err) {
            console.error(err);
            setProfileFeedback('error');
            addToast('Failed to save profile.', 'error');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleThresholdChange = (id, val) => {
        const v = parseInt(val, 10);
        if (isNaN(v) || v < 0) return;
        setInventory(prev => prev.map(i => i.item_id === id ? { ...i, low_stock_threshold: v } : i));
    };

    const saveThresholds = async () => {
        const modified = inventory.filter(i => i.low_stock_threshold !== origThresholds[i.item_id]);
        if (modified.length === 0) {
            addToast('No changes to save.', 'info');
            return;
        }
        setThresholdSaving(true);
        setThresholdFeedback('');
        try {
            await Promise.all(modified.map(i =>
                supabase.from('inventory_items')
                    .update({ low_stock_threshold: i.low_stock_threshold })
                    .eq('item_id', i.item_id)
                    .eq('clinic_id', clinicId)
            ));
            const newOrig = { ...origThresholds };
            modified.forEach(i => { newOrig[i.item_id] = i.low_stock_threshold; });
            setOrigThresholds(newOrig);
            setThresholdFeedback('success');
            addToast('Thresholds saved successfully.', 'success');
            setTimeout(() => setThresholdFeedback(''), 3000);
        } catch (err) {
            console.error(err);
            setThresholdFeedback('error');
            addToast('Failed to save thresholds.', 'error');
        } finally {
            setThresholdSaving(false);
        }
    };

    const handleNotifToggle = (key) => {
        const next = { ...notifications, [key]: !notifications[key] };
        setNotifications(next);
        if (currentSupplier) {
            localStorage.setItem('shop_notif_' + currentSupplier.user_id, JSON.stringify(next));
        }
    };

    const handleGlobalThresholdChange = (val) => {
        setGlobalThreshold(val);
        if (currentSupplier) {
            if (val === '' || val === '0') {
                localStorage.removeItem('shop_global_threshold_' + currentSupplier.user_id);
            } else {
                localStorage.setItem('shop_global_threshold_' + currentSupplier.user_id, val);
            }
        }
    };

    const resetThresholds = async () => {
        if (!window.confirm('Reset all thresholds to default (10)? This cannot be undone.')) return;
        try {
            await Promise.all(inventory.map(i =>
                supabase.from('inventory_items')
                    .update({ low_stock_threshold: 10 })
                    .eq('item_id', i.item_id)
                    .eq('clinic_id', clinicId)
            ));
            addToast('All thresholds reset to 10.', 'success');
            fetchInventory();
        } catch (err) {
            console.error(err);
            addToast('Failed to reset thresholds.', 'error');
        }
    };

    return (
        <div className="space-y-8 w-full">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
                <p className="text-slate-500 mt-1">Manage your shop profile, alert thresholds, and notification preferences.</p>
            </div>

            {/* Profile */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                    <User className="w-5 h-5 text-brand-500" />
                    <h3 className="font-bold text-slate-800">Shop Profile</h3>
                </div>
                <form onSubmit={handleProfileSave} className="p-6 space-y-4 w-full">
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Shop Name</label>
                        <input type="text" value={profileData.shopName} onChange={e => setProfileData({ ...profileData, shopName: e.target.value })} required
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1">Owner Name</label>
                        <input type="text" value={profileData.ownerName} onChange={e => setProfileData({ ...profileData, ownerName: e.target.value })} required
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Email</label>
                            <input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} required
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1">Phone</label>
                            <input type="tel" value={profileData.phone_number} onChange={e => setProfileData({ ...profileData, phone_number: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                        <button type="submit" disabled={profileSaving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
                        </button>
                        {profileFeedback === 'success' && <span className="text-sm font-semibold text-emerald-600">Saved!</span>}
                        {profileFeedback === 'error' && <span className="text-sm font-semibold text-red-500">Failed to save.</span>}
                    </div>
                </form>
            </div>

            {/* Inventory Alert Thresholds */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-800">Inventory Alert Thresholds</h3>
                </div>
                {invLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div> : (
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider sticky top-0">
                                    <th className="px-6 py-3">Item Name</th>
                                    <th className="px-6 py-3 text-right">Current Stock</th>
                                    <th className="px-6 py-3 text-right">Threshold</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inventory.map(item => {
                                    const wouldTrigger = item.current_stock < item.low_stock_threshold;
                                    const isModified = item.low_stock_threshold !== origThresholds[item.item_id];
                                    return (
                                        <tr key={item.item_id} className={'transition-colors ' + (wouldTrigger ? 'bg-amber-50/40' : 'hover:bg-slate-50')}>
                                            <td className="px-6 py-3 text-sm font-bold text-slate-800">{item.item_name}</td>
                                            <td className="px-6 py-3 text-sm text-slate-600 text-right">{item.current_stock}</td>
                                            <td className="px-6 py-3 text-right">
                                                <input type="number" min="0" value={item.low_stock_threshold}
                                                    onChange={e => handleThresholdChange(item.item_id, e.target.value)}
                                                    className={'w-24 px-3 py-1.5 text-sm font-bold border-2 rounded-lg text-right ' +
                                                        (wouldTrigger ? 'border-amber-300 text-amber-700 bg-white' : 'border-slate-200 text-slate-700 bg-white') +
                                                        (isModified ? ' ring-2 ring-brand-100' : '')} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center gap-4">
                    <button onClick={saveThresholds} disabled={thresholdSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">
                        {thresholdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All Thresholds
                    </button>
                    {thresholdFeedback === 'success' && <span className="text-sm font-semibold text-emerald-600">Saved!</span>}
                    {thresholdFeedback === 'error' && <span className="text-sm font-semibold text-red-500">Failed.</span>}
                </div>
            </div>

            {/* Global Threshold Override */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                    <Sliders className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-slate-800">Global Low Stock Override</h3>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-4">
                        Set a global threshold. If set, this value overrides individual thresholds in the Dashboard alert panel.
                        Leave blank or set to 0 to use individual thresholds.
                    </p>
                    <div className="flex items-center gap-4">
                        <input type="number" min="0" placeholder="e.g. 15" value={globalThreshold}
                            onChange={e => handleGlobalThresholdChange(e.target.value)}
                            className="w-32 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-500 bg-white text-sm font-bold" />
                        <span className="text-sm text-slate-500">units</span>
                        {globalThreshold && parseInt(globalThreshold) > 0 && (
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                Override active: {globalThreshold} units
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Notifications */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
                        <Bell className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-slate-800">Notifications</h3>
                    </div>
                    <div className="p-2">
                        {[
                            { key: 'newOnlineOrder', label: 'New online order received', desc: 'When a customer places an online order' },
                            { key: 'lowStock', label: 'Item reaches low stock', desc: 'When stock drops below threshold after a sale' },
                            { key: 'outOfStock', label: 'Item is out of stock', desc: 'When stock reaches zero' },
                            { key: 'restockLogged', label: 'Restock logged successfully', desc: 'When a restock entry is recorded' }
                        ].map((item, i) => (
                            <div key={item.key} className={'p-4 flex items-center justify-between ' + (i < 3 ? 'border-b border-slate-100' : '')}>
                                <div>
                                    <h4 className="font-semibold text-slate-800 text-sm">{item.label}</h4>
                                    <p className="text-xs text-slate-500">{item.desc}</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" className="sr-only peer" checked={notifications[item.key]} onChange={() => handleNotifToggle(item.key)} />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-2xl border border-red-100 shadow-soft overflow-hidden self-start">
                    <div className="p-5 border-b border-red-100 flex items-center gap-3 bg-red-50">
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-red-900">Danger Zone</h3>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-slate-600 mb-4">Resetting thresholds will set all inventory items to the default value (10). This cannot be undone.</p>
                        <button onClick={resetThresholds}
                            className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold text-sm transition-colors">
                            <AlertTriangle className="w-4 h-4" /> Reset all thresholds to default (10)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopSettings;
