import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    DollarSign, TrendingUp, ShoppingCart, AlertTriangle, Package,
    Loader2, CheckCircle2, Clock, ShoppingBag, ArrowDownToLine
} from 'lucide-react';

const getRelativeTime = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return diff + ' min ago';
    if (diff < 1440) return Math.floor(diff / 60) + ' hr ago';
    return Math.floor(diff / 1440) + ' days ago';
};

const ShopDashboard = ({ onNavigate }) => {
    const { currentSupplier, clinicId } = useSupplierApp();
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState({ todayRevenue: 0, monthRevenue: 0, pendingOrders: 0, lowStockCount: 0, totalProducts: 0 });
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
    const [activityFeed, setActivityFeed] = useState([]);

    useEffect(() => {
        if (currentSupplier && clinicId) {
            fetchAll();
            const channel = supabase.channel('shop_dashboard_rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchAll())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAll())
                .subscribe();
            return () => supabase.removeChannel(channel);
        }
    }, [currentSupplier, clinicId]);

    const fetchAll = async () => {
        if (!clinicId) return;
        setLoading(true);
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { data: todayInv } = await supabase
                .from('invoices').select('total_amount')
                .eq('shop_id', clinicId)
                .eq('status', 'Paid').gte('issue_date', todayStart);
            const todayRevenue = (todayInv || []).reduce((s, i) => s + Number(i.total_amount), 0);

            const { data: monthInv } = await supabase
                .from('invoices').select('total_amount')
                .eq('shop_id', clinicId)
                .eq('status', 'Paid').gte('issue_date', monthStart);
            const monthRevenue = (monthInv || []).reduce((s, i) => s + Number(i.total_amount), 0);

            const { count: pendingOrders } = await supabase
                .from('orders').select('*', { count: 'exact', head: true })
                .eq('shop_id', clinicId)
                .eq('status', 'Processing');

            const { data: invItems } = await supabase
                .from('inventory_items').select('*')
                .eq('clinic_id', clinicId)
                .order('current_stock', { ascending: true });
            const lowItems = (invItems || []).filter(i => i.current_stock < i.low_stock_threshold);

            const { count: totalProducts } = await supabase
                .from('products').select('*', { count: 'exact', head: true })
                .eq('shop_id', clinicId);

            setKpis({
                todayRevenue,
                monthRevenue,
                pendingOrders: pendingOrders || 0,
                lowStockCount: lowItems.length,
                totalProducts: totalProducts || 0
            });

            // Low stock alerts with severity
            const alertItems = lowItems.map(item => {
                let severity, severityLabel, severityClass;
                if (item.current_stock === 0) {
                    severity = 0; severityLabel = 'Out of stock';
                    severityClass = 'bg-red-100 text-red-700';
                } else if (item.current_stock < item.low_stock_threshold / 2) {
                    severity = 1; severityLabel = 'Critical';
                    severityClass = 'bg-red-50 text-red-600';
                } else {
                    severity = 2; severityLabel = 'Low';
                    severityClass = 'bg-amber-50 text-amber-600';
                }
                return { ...item, severity, severityLabel, severityClass };
            }).sort((a, b) => a.severity - b.severity || a.current_stock - b.current_stock);

            setLowStockAlerts(alertItems);

            const { data: recentInvoices } = await supabase
                .from('invoices').select('invoice_id, total_amount, issue_date, status, guest_client_name')
                .eq('shop_id', clinicId)
                .order('issue_date', { ascending: false }).limit(10);

            const { data: recentOrders } = await supabase
                .from('orders').select('order_id, status, order_date, total_amount, shipping_address, profiles:user_id(user_name)')
                .eq('shop_id', clinicId)
                .order('order_date', { ascending: false }).limit(10);

            let feed = [];

            (recentInvoices || []).forEach(inv => {
                if (inv.status === 'Paid') {
                    feed.push({
                        id: 'inv-' + inv.invoice_id,
                        type: 'sale',
                        dotColor: 'bg-emerald-500',
                        title: `Sale completed — EGP ${Number(inv.total_amount).toFixed(2)}`,
                        desc: inv.guest_client_name || 'Customer',
                        timestamp: inv.issue_date
                    });
                }
            });

            (recentOrders || []).forEach(o => {
                const name = (o.profiles && o.profiles.user_name) || 'Customer';
                if (o.status === 'Processing') {
                    feed.push({
                        id: 'order-new-' + o.order_id,
                        type: 'online_order',
                        dotColor: 'bg-blue-500',
                        title: `New online order from ${name}`,
                        desc: `EGP ${Number(o.total_amount).toFixed(2)}`,
                        timestamp: o.order_date
                    });
                }
            });

            feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setActivityFeed(feed.slice(0, 10));
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
    }

    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const summaryParts = [];
    if (kpis.pendingOrders > 0) summaryParts.push(`${kpis.pendingOrders} pending online order${kpis.pendingOrders > 1 ? 's' : ''}`);
    if (kpis.lowStockCount > 0) summaryParts.push(`${kpis.lowStockCount} item${kpis.lowStockCount > 1 ? 's' : ''} running low`);
    const summaryLine = summaryParts.length > 0 ? `You have ${summaryParts.join(' and ')}.` : 'Everything looks great today!';

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Greeting */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">
                    Welcome back, {currentSupplier ? currentSupplier.user_name : 'Shop Owner'}
                </h2>
                <p className="text-slate-500 mt-1">{todayDate}</p>
                <p className="text-sm text-slate-600 mt-2 bg-slate-50 inline-block px-4 py-2 rounded-xl border border-slate-100">
                    {summaryLine}
                </p>
            </div>

            {/* KPI Strip — 5 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div onClick={() => onNavigate('reports')} className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-soft cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Today's Revenue</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {kpis.todayRevenue.toFixed(2)}</h3>
                </div>
                <div onClick={() => onNavigate('reports')} className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-soft cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                    </div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">This Month</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {kpis.monthRevenue.toFixed(2)}</h3>
                </div>
                <div onClick={() => onNavigate('online-orders')} className={`bg-white p-5 rounded-2xl border shadow-soft cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${kpis.pendingOrders > 0 ? 'border-amber-200' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${kpis.pendingOrders > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                            <ShoppingCart className={`w-5 h-5 ${kpis.pendingOrders > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                        </div>
                    </div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${kpis.pendingOrders > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Pending Orders</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.pendingOrders}</h3>
                </div>
                <div onClick={() => onNavigate('settings')} className={`bg-white p-5 rounded-2xl border shadow-soft cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${kpis.lowStockCount > 0 ? 'border-red-200' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${kpis.lowStockCount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                            <AlertTriangle className={`w-5 h-5 ${kpis.lowStockCount > 0 ? 'text-red-600' : 'text-slate-500'}`} />
                        </div>
                    </div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${kpis.lowStockCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>Low Stock</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.lowStockCount}</h3>
                </div>
                <div onClick={() => onNavigate('products')} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-slate-50"><Package className="w-5 h-5 text-slate-500" /></div>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.totalProducts}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Low Stock Alert Panel */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" /> Low Stock Alerts
                    </h3>
                    {lowStockAlerts.length === 0 ? (
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">All stock levels are healthy</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {lowStockAlerts.map(item => (
                                <div key={item.item_id} onClick={() => onNavigate('settings')} className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer hover:shadow-sm hover:scale-[1.01] ${
                                    item.severity === 0 ? 'border-red-200 bg-red-50/30 hover:bg-red-50' :
                                    item.severity === 1 ? 'border-red-100 bg-red-50/20 hover:bg-red-50' :
                                    'border-amber-100 bg-amber-50/20 hover:bg-amber-50'
                                }`}>
                                    <div>
                                        <p className="font-semibold text-slate-800">{item.item_name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Current: <span className="font-bold">{item.current_stock}</span> / Threshold: {item.low_stock_threshold}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.severityClass}`}>
                                        {item.severityLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Activity Feed */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-brand-500" /> Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {activityFeed.length === 0 ? (
                            <p className="text-slate-500 text-sm">No recent activity.</p>
                        ) : activityFeed.map((event, idx) => (
                            <div key={event.id || idx} onClick={() => onNavigate(event.type === 'sale' ? 'reports' : 'online-orders')} 
                                 className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${event.dotColor}`}></div>
                                <div>
                                    <p className="text-sm font-medium text-slate-800">{event.title}</p>
                                    {event.desc && <p className="text-xs text-slate-400 mt-0.5">{event.desc}</p>}
                                    <p className="text-xs text-slate-500" title={new Date(event.timestamp).toLocaleString()}>
                                        {getRelativeTime(event.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopDashboard;
