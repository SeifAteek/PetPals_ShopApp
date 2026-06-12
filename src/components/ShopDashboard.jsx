import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import {
    DollarSign, TrendingUp, ShoppingCart, AlertTriangle, Package,
    Loader2, CheckCircle2, Clock
} from 'lucide-react';

/** Convert an ISO date string to a human-readable relative time label */
const relativeTime = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1)    return 'just now';
    if (diff < 60)   return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`;
    return `${Math.floor(diff / 1440)} days ago`;
};

const ShopDashboard = ({ onNavigate }) => {
    const { currentSupplier, clinicId, cachedProducts } = useSupplierApp();

    const [loading,        setLoading]        = useState(true);
    const [kpis,           setKpis]           = useState({ todayRevenue: 0, monthRevenue: 0, pendingOrders: 0, lowStockCount: 0, totalProducts: 0 });
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
    const [activityFeed,   setActivityFeed]   = useState([]);

    /* ─────────────────────────── data fetch ─────────────────────────── */

    const fetchAll = async (showLoader = true) => {
        if (!clinicId) return;
        if (showLoader) setLoading(true);
        try {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthStartStr = startOfMonth.toISOString(); // For Supabase server-side filtering

            /* Revenue */
            const { data: monthInv } = await supabase
                .from('invoices').select('total_amount, issue_date')
                .eq('shop_id', clinicId).eq('status', 'Paid')
                .gte('issue_date', monthStartStr);
            
            const monthRevenue = (monthInv || [])
                .filter(i => new Date(i.issue_date) >= startOfMonth)
                .reduce((s, i) => s + Number(i.total_amount), 0);
            
            const todayRevenue = (monthInv || [])
                .filter(i => new Date(i.issue_date) >= startOfToday)
                .reduce((s, i) => s + Number(i.total_amount), 0);

            /* Orders */
            const { count: pendingOrders } = await supabase
                .from('orders').select('*', { count: 'exact', head: true })
                .eq('shop_id', clinicId).eq('status', 'Processing');

            /* Inventory & Products via cachedProducts */
            const totalProducts = cachedProducts.length;
            const lowItems = cachedProducts.filter(i => i.current_stock < i.low_stock_threshold);

            setKpis({ todayRevenue, monthRevenue, pendingOrders: pendingOrders || 0, lowStockCount: lowItems.length, totalProducts });

            /* Low-stock alerts with severity */
            const alerts = lowItems.map(item => {
                const severity = item.current_stock === 0 ? 0
                    : item.current_stock < item.low_stock_threshold / 2 ? 1 : 2;
                const severityLabel = ['Out of Stock', 'Critical', 'Low Stock'][severity];
                return { ...item, severity, severityLabel };
            }).sort((a, b) => a.severity - b.severity || a.current_stock - b.current_stock);
            setLowStockAlerts(alerts);

            /* Recent activity */
            const { data: recentInv } = await supabase
                .from('invoices').select('invoice_id, total_amount, issue_date, status, guest_client_name')
                .eq('shop_id', clinicId).order('issue_date', { ascending: false }).limit(10);

            const { data: recentOrders } = await supabase
                .from('orders').select('order_id, status, order_date, total_amount, profiles:user_id(user_name)')
                .eq('shop_id', clinicId).order('order_date', { ascending: false }).limit(10);

            let feed = [];
            (recentInv || []).filter(i => i.status === 'Paid').forEach(inv => feed.push({
                id: 'inv-' + inv.invoice_id, type: 'sale', dotColor: '#10B981',
                title: `Sale completed — EGP ${Number(inv.total_amount).toFixed(2)}`,
                desc:  inv.guest_client_name || 'Walk-in Customer',
                timestamp: inv.issue_date,
            }));
            (recentOrders || []).filter(o => o.status === 'Processing').forEach(o => feed.push({
                id: 'ord-' + o.order_id, type: 'online_order', dotColor: '#3B82F6',
                title: `New online order — ${o.profiles?.user_name || 'Online Customer'}`,
                desc:  `EGP ${Number(o.total_amount).toFixed(2)}`,
                timestamp: o.order_date,
            }));
            feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setActivityFeed(feed.slice(0, 12));
        } catch (err) {
            console.error('[ShopDashboard] fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentSupplier && clinicId) {
            fetchAll(true);  /* ← show spinner on initial load */

            /* Realtime subscription: update silently (no spinner) */
            const channel = supabase.channel('shop_dashboard_rt')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchAll(false))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders'   }, () => fetchAll(false))
                .subscribe();
            return () => supabase.removeChannel(channel);
        }
    }, [currentSupplier, clinicId]);

    /* ─────────────────────────── loading state ─────────────────────────── */

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' }}>
                <Loader2 style={{ width: 32, height: 32, color: 'var(--pp-primary, #2E7D32)', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    /* ─────────────────────────── derived data ─────────────────────────── */

    const todayDate   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const parts       = [];
    if (kpis.pendingOrders > 0) parts.push(`${kpis.pendingOrders} pending order${kpis.pendingOrders > 1 ? 's' : ''}`);
    if (kpis.lowStockCount  > 0) parts.push(`${kpis.lowStockCount} low-stock item${kpis.lowStockCount > 1 ? 's' : ''}`);
    const summary = parts.length > 0 ? `You have ${parts.join(' and ')}.` : 'All systems operating normally today.';

    /* ─────────────────────────── style constants ─────────────────────────── */

    const CARD = {
        background:   'var(--pp-card-bg,     #FFFFFF)',
        border:       '1px solid var(--pp-card-border, #D1E7DD)',
        borderRadius: 'var(--pp-r-2xl,       18px)',
        boxShadow:    'var(--pp-shadow-resting, 0 1px 3px rgba(0,0,0,0.06))',
    };
    const PRIMARY      = 'var(--pp-primary,        #2E7D32)';
    const PRIMARY_LIGHT= 'var(--pp-primary-light,  rgba(46,125,50,0.10))';
    const TEXT_P       = 'var(--pp-text-primary,   #111827)';
    const TEXT_S       = 'var(--pp-text-secondary, #374151)';
    const TEXT_M       = 'var(--pp-text-muted,     #6B7280)';

    const hoverIn  = (e, shadow = 'var(--pp-shadow-raised, 0 6px 20px rgba(46,125,50,0.14))') => {
        e.currentTarget.style.boxShadow = shadow;
        e.currentTarget.style.transform = 'translateY(-2px)';
    };
    const hoverOut = (e) => {
        e.currentTarget.style.boxShadow = 'var(--pp-shadow-resting, 0 1px 3px rgba(0,0,0,0.06))';
        e.currentTarget.style.transform = 'translateY(0)';
    };

    /* ─────────────────────────── KPI definitions ─────────────────────────── */

    const kpiCards = [
        {
            label:  "Today's Revenue",
            value:  `EGP ${kpis.todayRevenue.toFixed(2)}`,
            icon:   DollarSign,
            tab:    'reports',
            accent: PRIMARY,
            iconBg: PRIMARY_LIGHT,
        },
        {
            label:  'Monthly Revenue',
            value:  `EGP ${kpis.monthRevenue.toFixed(2)}`,
            icon:   TrendingUp,
            tab:    'reports',
            accent: PRIMARY,
            iconBg: PRIMARY_LIGHT,
        },
        {
            label:  'Pending Orders',
            value:  String(kpis.pendingOrders),
            icon:   ShoppingCart,
            tab:    'online-orders',
            accent: kpis.pendingOrders > 0 ? '#F59E0B' : PRIMARY,
            iconBg: kpis.pendingOrders > 0 ? 'rgba(245,158,11,0.09)' : PRIMARY_LIGHT,
            warnBorder: kpis.pendingOrders > 0,
            shadowWarn: kpis.pendingOrders > 0 ? 'rgba(245,158,11,0.14)' : undefined,
        },
        {
            label:  'Low Stock Items',
            value:  String(kpis.lowStockCount),
            icon:   AlertTriangle,
            tab:    'settings',
            accent: kpis.lowStockCount > 0 ? '#EF4444' : PRIMARY,
            iconBg: kpis.lowStockCount > 0 ? 'rgba(239,68,68,0.08)' : PRIMARY_LIGHT,
            warnBorder: kpis.lowStockCount > 0,
            danger: kpis.lowStockCount > 0,
            shadowWarn: kpis.lowStockCount > 0 ? 'rgba(239,68,68,0.14)' : undefined,
        },
        {
            label:  'Product Catalog',
            value:  String(kpis.totalProducts),
            icon:   Package,
            tab:    'products',
            accent: PRIMARY,
            iconBg: PRIMARY_LIGHT,
        },
    ];

    /* ─────────────────────────── render ─────────────────────────── */

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* ── Greeting ── */}
            <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT_P, margin: 0, letterSpacing: '-0.02em' }}>
                    Welcome back, {currentSupplier ? currentSupplier.user_name : 'Shop Manager'}
                </h2>
                <p style={{ fontSize: 13, color: TEXT_M, margin: '4px 0 14px' }}>{todayDate}</p>
                <span style={{
                    display: 'inline-block',
                    background: PRIMARY_LIGHT,
                    border: '1px solid var(--pp-card-border, #D1E7DD)',
                    borderRadius: 99,
                    padding: '5px 14px',
                    fontSize: 12,
                    color: TEXT_S,
                    fontWeight: 500,
                }}>
                    {summary}
                </span>
            </div>

            {/* ── KPI strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14 }}>
                {kpiCards.map(({ label, value, icon: Icon, tab, accent, iconBg, warnBorder, danger, shadowWarn }) => (
                    <div
                        key={label}
                        id={`kpi-${label.toLowerCase().replace(/\s+/g,'_')}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onNavigate(tab)}
                        onKeyDown={e => e.key === 'Enter' && onNavigate(tab)}
                        style={{
                            ...CARD,
                            padding: 18,
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            borderColor: warnBorder
                                ? (danger ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)')
                                : 'var(--pp-card-border, #D1E7DD)',
                        }}
                        onMouseEnter={e => hoverIn(e, `0 6px 20px ${shadowWarn || 'rgba(46,125,50,0.14)'}`)}
                        onMouseLeave={hoverOut}
                    >
                        <div style={{ display: 'inline-flex', background: iconBg, borderRadius: 12, padding: 10, marginBottom: 12 }}>
                            <Icon style={{ width: 20, height: 20, color: accent }} />
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accent, margin: 0 }}>
                            {label}
                        </p>
                        <h3 style={{ fontSize: 21, fontWeight: 800, color: TEXT_P, margin: '5px 0 0', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                            {value}
                        </h3>
                    </div>
                ))}
            </div>

            {/* ── Bottom panels ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

                {/* Inventory alerts */}
                <div style={{ ...CARD, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <AlertTriangle style={{ width: 17, height: 17, color: '#EF4444', flexShrink: 0 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_P, margin: 0 }}>Inventory Alerts</h3>
                    </div>

                    {lowStockAlerts.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px' }}>
                            <CheckCircle2 style={{ width: 18, height: 18, color: '#10B981', flexShrink: 0 }} />
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#065F46', margin: 0 }}>Inventory levels are healthy</p>
                                <p style={{ fontSize: 12, color: '#059669', margin: '2px 0 0' }}>No restocking required at this time</p>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {lowStockAlerts.map(item => {
                                const isCrit  = item.severity <= 1;
                                const bdrC    = isCrit ? 'rgba(239,68,68,0.25)'  : 'rgba(245,158,11,0.25)';
                                const bgC     = isCrit ? 'rgba(239,68,68,0.05)'  : 'rgba(245,158,11,0.05)';
                                const bgHover = isCrit ? 'rgba(239,68,68,0.10)'  : 'rgba(245,158,11,0.10)';
                                const textC   = isCrit ? '#EF4444' : '#F59E0B';
                                return (
                                    <div
                                        key={item.item_id}
                                        onClick={() => onNavigate('settings')}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: bgC, border: `1px solid ${bdrC}`, borderRadius: 12, cursor: 'pointer', transition: 'background 0.14s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = bgHover}
                                        onMouseLeave={e => e.currentTarget.style.background = bgC}
                                    >
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_P, margin: 0 }}>{item.item_name}</p>
                                            <p style={{ fontSize: 11, color: TEXT_M, margin: '2px 0 0' }}>
                                                Stock: <strong style={{ color: textC }}>{item.current_stock}</strong> · Min: {item.low_stock_threshold}
                                            </p>
                                        </div>
                                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: isCrit ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: textC, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {item.severityLabel}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent activity */}
                <div style={{ ...CARD, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Clock style={{ width: 17, height: 17, color: PRIMARY, flexShrink: 0 }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT_P, margin: 0 }}>Recent Activity</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {activityFeed.length === 0 ? (
                            <p style={{ fontSize: 13, color: TEXT_M, textAlign: 'center', padding: '24px 0', margin: 0 }}>No recent activity.</p>
                        ) : activityFeed.map((event, idx) => (
                            <div
                                key={event.id || idx}
                                onClick={() => onNavigate(event.type === 'sale' ? 'reports' : 'online-orders')}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 8px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = PRIMARY_LIGHT}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: event.dotColor, flexShrink: 0, marginTop: 7 }} />
                                <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: TEXT_P, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</p>
                                    {event.desc && <p style={{ fontSize: 11, color: TEXT_M, margin: '1px 0 0' }}>{event.desc}</p>}
                                    <p style={{ fontSize: 11, color: TEXT_M, margin: '1px 0 0' }}>{relativeTime(event.timestamp)}</p>
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
