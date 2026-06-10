import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    Loader2, DollarSign, TrendingUp, TrendingDown, ShoppingCart,
    BarChart3, PieChart, Calendar, ArrowUpDown, Percent
} from 'lucide-react';

const ShopReports = () => {
    const { clinicId, addToast } = useSupplierApp();
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [kpis, setKpis] = useState({ revenue: 0, cost: 0, profit: 0, margin: 0, totalOrders: 0, avgOrderValue: 0 });
    const [revenueOverTime, setRevenueOverTime] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [channelSplit, setChannelSplit] = useState({ inStore: 0, online: 0 });
    const [categoryRevenue, setCategoryRevenue] = useState([]);
    const [recentTxns, setRecentTxns] = useState([]);
    const [sortCol, setSortCol] = useState('date');
    const [sortDesc, setSortDesc] = useState(true);

    useEffect(() => { if (clinicId) fetchAll(); }, [startDate, endDate, clinicId]);

    const fetchAll = async () => {
        if (!clinicId) return;
        setLoading(true);
        try {
            const start = new Date(startDate).toISOString();
            const end = new Date(endDate + 'T23:59:59').toISOString();

            const { data: invoices } = await supabase
                .from('invoices')
                .select('invoice_id, total_amount, status, issue_date, guest_client_name, client_id')
                .eq('shop_id', clinicId)
                .eq('status', 'Paid')
                .gte('issue_date', start)
                .lte('issue_date', end);

            const { data: expenses } = await supabase
                .from('clinic_expenses')
                .select('amount, expense_date')
                .eq('clinic_id', clinicId)
                .eq('category', 'Inventory Restock')
                .gte('expense_date', start)
                .lte('expense_date', end);

            const { data: orders } = await supabase
                .from('orders')
                .select('order_id, total_amount, status, order_date, shipping_address, payment_method, profiles:user_id(user_name)')
                .eq('shop_id', clinicId)
                .gte('order_date', start)
                .lte('order_date', end);

            // Order items with products
            const orderIds = (orders || []).map(o => o.order_id);
            let orderItemsData = [];
            if (orderIds.length > 0) {
                const { data } = await supabase
                    .from('order_items')
                    .select('quantity, sub_total, order_id, products:product_id(name, category)')
                    .in('order_id', orderIds);
                orderItemsData = data || [];
            }

            const revenue = (invoices || []).reduce((s, i) => s + Number(i.total_amount), 0);
            const cost = (expenses || []).reduce((s, e) => s + Number(e.amount), 0);
            const profit = revenue - cost;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
            const totalOrders = (orders || []).length;
            // Avg sale value derived from invoices (which represent completed sales).
            const paidCount = (invoices || []).length;
            const avgOrderValue = paidCount > 0 ? revenue / paidCount : 0;

            setKpis({ revenue, cost, profit, margin, totalOrders, avgOrderValue });

            // Revenue vs Cost over time (daily)
            const dayMap = {};
            (invoices || []).forEach(inv => {
                const day = inv.issue_date.split('T')[0];
                if (!dayMap[day]) dayMap[day] = { day, revenue: 0, cost: 0 };
                dayMap[day].revenue += Number(inv.total_amount);
            });
            (expenses || []).forEach(exp => {
                const day = exp.expense_date.split('T')[0];
                if (!dayMap[day]) dayMap[day] = { day, revenue: 0, cost: 0 };
                dayMap[day].cost += Number(exp.amount);
            });
            const timeline = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));
            setRevenueOverTime(timeline);

            // Top selling products
            const prodMap = {};
            orderItemsData.forEach(i => {
                const name = i.products?.name || 'Unknown';
                prodMap[name] = (prodMap[name] || 0) + i.quantity;
            });
            setTopProducts(Object.entries(prodMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8));

            // Channel split
            const deliveredOrders = (orders || []).filter(o => o.status === 'Delivered');
            let inStoreRev = 0, onlineRev = 0;
            deliveredOrders.forEach(o => {
                if (o.shipping_address === 'In-store') inStoreRev += Number(o.total_amount);
                else onlineRev += Number(o.total_amount);
            });
            setChannelSplit({ inStore: inStoreRev, online: onlineRev });

            // Revenue by category
            const catMap = {};
            orderItemsData.forEach(i => {
                const cat = i.products?.category || 'Other';
                catMap[cat] = (catMap[cat] || 0) + Number(i.sub_total);
            });
            setCategoryRevenue(Object.entries(catMap).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount));

            // Recent transactions (from invoices)
            const txns = (invoices || []).slice(0, 15).map(inv => {
                // Find matching order for channel info
                const matchOrder = (orders || []).find(o =>
                    Math.abs(Number(o.total_amount) - Number(inv.total_amount)) < 0.01
                );
                const isInStore = matchOrder?.shipping_address === 'In-store';
                return {
                    id: inv.invoice_id,
                    date: inv.issue_date,
                    customer: inv.guest_client_name || matchOrder?.profiles?.user_name || 'Customer',
                    items: '—',
                    total: Number(inv.total_amount),
                    payment: matchOrder?.payment_method || 'Cash',
                    channel: isInStore ? 'In-store' : 'Online'
                };
            });
            setRecentTxns(txns);

        } catch (err) {
            console.error('Reports error:', err);
            addToast('Failed to load reports.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (col) => {
        if (sortCol === col) setSortDesc(!sortDesc);
        else { setSortCol(col); setSortDesc(true); }
    };

    const sortedTxns = useMemo(() => {
        return [...recentTxns].sort((a, b) => {
            let va = a[sortCol], vb = b[sortCol];
            if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
            if (va < vb) return sortDesc ? 1 : -1;
            if (va > vb) return sortDesc ? -1 : 1;
            return 0;
        });
    }, [recentTxns, sortCol, sortDesc]);

    const catColors = { Vaccine: 'bg-emerald-500', Medicine: 'bg-blue-500', Consumable: 'bg-amber-500', Retail: 'bg-pink-500', Other: 'bg-slate-400' };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

    const maxProd = Math.max(...topProducts.map(p => p.count), 1);
    const maxTimeline = Math.max(...revenueOverTime.map(d => Math.max(d.revenue, d.cost)), 1);
    const maxCat = Math.max(...categoryRevenue.map(c => c.amount), 1);
    const totalChannel = channelSplit.inStore + channelSplit.online || 1;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Reports & Analytics</h2>
                    <p className="text-slate-500 mt-1">Understand your business performance at a glance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="border-none text-sm font-medium text-slate-700 focus:outline-none bg-transparent" />
                        <span className="text-slate-300">→</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                            className="border-none text-sm font-medium text-slate-700 focus:outline-none bg-transparent" />
                    </div>
                </div>
            </div>

            {/* KPI Strip — 6 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-emerald-50 w-fit mb-3"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Revenue</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {kpis.revenue.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-red-50 w-fit mb-3"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Total Cost</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {kpis.cost.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-brand-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-brand-50 w-fit mb-3"><TrendingUp className="w-5 h-5 text-brand-600" /></div>
                    <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Gross Profit</p>
                    <h3 className={`text-2xl font-bold mt-1 ${kpis.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>EGP {kpis.profit.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-blue-50 w-fit mb-3"><Percent className="w-5 h-5 text-blue-600" /></div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Margin</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.margin.toFixed(1)}%</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-purple-50 w-fit mb-3"><ShoppingCart className="w-5 h-5 text-purple-600" /></div>
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Total Orders</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{kpis.totalOrders}</h3>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft">
                    <div className="p-2.5 rounded-xl bg-tangerine-50 w-fit mb-3"><DollarSign className="w-5 h-5 text-tangerine-600" /></div>
                    <p className="text-xs font-semibold text-tangerine-600 uppercase tracking-wider">Avg. Sale</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">EGP {kpis.avgOrderValue.toFixed(2)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue vs Cost Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Revenue vs Cost Over Time</h3>
                    <div className="flex items-center gap-6 mb-4">
                        <span className="flex items-center gap-2 text-xs font-bold text-emerald-600"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Revenue</span>
                        <span className="flex items-center gap-2 text-xs font-bold text-red-500"><div className="w-3 h-3 rounded-full bg-red-400" /> Cost</span>
                    </div>
                    {revenueOverTime.length === 0 ? (
                        <p className="text-sm text-slate-400 py-8 text-center">No data in selected range.</p>
                    ) : (
                        <div className="relative h-52">
                            {/* Simple bar chart */}
                            <div className="flex items-end gap-1 h-48 border-b border-slate-200 px-1">
                                {revenueOverTime.map((d, i) => {
                                    const revH = Math.max((d.revenue / maxTimeline) * 100, 1);
                                    const costH = Math.max((d.cost / maxTimeline) * 100, 1);
                                    return (
                                        <div key={i} className="flex-1 flex gap-0.5 items-end h-full group relative" title={`${d.day}\nRevenue: EGP ${d.revenue.toFixed(2)}\nCost: EGP ${d.cost.toFixed(2)}`}>
                                            <div className="flex-1 bg-emerald-400 hover:bg-emerald-500 rounded-t transition-all" style={{ height: revH + '%' }} />
                                            {d.cost > 0 && <div className="flex-1 bg-red-300 hover:bg-red-400 rounded-t transition-all" style={{ height: costH + '%' }} />}
                                        </div>
                                    );
                                })}
                            </div>
                            {revenueOverTime.length <= 15 && (
                                <div className="flex gap-1 px-1 mt-1">
                                    {revenueOverTime.map((d, i) => (
                                        <div key={i} className="flex-1 text-center text-[8px] font-bold text-slate-400 truncate">
                                            {new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Top Selling Products */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-brand-500" /> Top Selling Products
                    </h3>
                    {topProducts.length === 0 ? <p className="text-sm text-slate-400">No data.</p> : (
                        <div className="space-y-4">
                            {topProducts.map((p, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-32 truncate text-sm font-semibold text-slate-600 text-right">{p.name}</div>
                                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: ((p.count / maxProd) * 100) + '%' }} />
                                    </div>
                                    <div className="w-10 text-sm font-bold text-slate-800 text-right">{p.count}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sales by Channel */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-500" /> Sales by Channel
                    </h3>
                    <div className="w-full h-8 flex rounded-xl overflow-hidden mb-4">
                        <div className="bg-brand-500 h-full transition-all" style={{ width: ((channelSplit.inStore / totalChannel) * 100) + '%' }} />
                        <div className="bg-purple-500 h-full transition-all" style={{ width: ((channelSplit.online / totalChannel) * 100) + '%' }} />
                    </div>
                    <div className="flex justify-between text-sm font-bold mb-6">
                        <span className="text-brand-700 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-500" /> In-store</span>
                        <span className="text-purple-700 flex items-center gap-2">Online <div className="w-3 h-3 rounded-full bg-purple-500" /></span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl text-center">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">In-store Revenue</p>
                            <p className="text-xl font-bold text-slate-900">EGP {channelSplit.inStore.toFixed(2)}</p>
                            <p className="text-xs font-semibold text-brand-600">{((channelSplit.inStore / totalChannel) * 100).toFixed(0)}%</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl text-center">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Online Revenue</p>
                            <p className="text-xl font-bold text-slate-900">EGP {channelSplit.online.toFixed(2)}</p>
                            <p className="text-xs font-semibold text-purple-600">{((channelSplit.online / totalChannel) * 100).toFixed(0)}%</p>
                        </div>
                    </div>
                </div>

                {/* Revenue by Category */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-soft">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-tangerine-500" /> Revenue by Category
                    </h3>
                    {categoryRevenue.length === 0 ? <p className="text-sm text-slate-400">No data.</p> : (
                        <div className="space-y-4">
                            {categoryRevenue.map((c, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-24 truncate text-sm font-semibold text-slate-600 text-right">{c.cat}</div>
                                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${catColors[c.cat] || catColors.Other}`}
                                            style={{ width: ((c.amount / maxCat) * 100) + '%' }} />
                                    </div>
                                    <div className="w-20 text-sm font-bold text-slate-800 text-right">EGP {c.amount.toFixed(0)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Transactions by Channel — shared col */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
                    <h3 className="text-lg font-bold text-slate-900 p-6 pb-3">Recent Transactions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                    <th className="px-5 py-3 cursor-pointer" onClick={() => handleSort('date')}>Date <ArrowUpDown className="w-3 h-3 inline ml-0.5" /></th>
                                    <th className="px-5 py-3 cursor-pointer" onClick={() => handleSort('customer')}>Customer</th>
                                    <th className="px-5 py-3 text-right cursor-pointer" onClick={() => handleSort('total')}>Total</th>
                                    <th className="px-5 py-3">Payment</th>
                                    <th className="px-5 py-3">Channel</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedTxns.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center py-8 text-sm text-slate-400">No transactions.</td></tr>
                                ) : sortedTxns.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 text-sm text-slate-500">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                        <td className="px-5 py-3 text-sm font-semibold text-slate-700">{t.customer}</td>
                                        <td className="px-5 py-3 text-sm font-bold text-slate-900 text-right">EGP {t.total.toFixed(2)}</td>
                                        <td className="px-5 py-3 text-xs text-slate-500">{t.payment}</td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${t.channel === 'In-store' ? 'bg-brand-50 text-brand-700' : 'bg-purple-50 text-purple-700'}`}>
                                                {t.channel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopReports;
