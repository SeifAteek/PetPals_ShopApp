import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import { PetPalsBrand } from '@petpals/theme/PetPalsLogo.jsx'
import MeshBackground from '@petpals/theme/MeshBackground.jsx';
import ThemeToggle from '@petpals/theme/ThemeToggle.jsx';
import {
    LayoutDashboard, Package, ShoppingBag, Globe, ArrowDownToLine,
    BarChart3, Settings as SettingsIcon, LogOut, Loader2, Store,
    ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';

import Login from './Login';

import ShopDashboard from './ShopDashboard';
import ShopProducts from './ShopProducts';
import ShopNewSale from './ShopNewSale';
import ShopOnlineOrders from './ShopOnlineOrders';
import ShopRestocking from './ShopRestocking';
import ShopReports from './ShopReports';
import ShopSettings from './ShopSettings';

const BRAND  = 'var(--pp-primary, #2E7D32)';
const NAVY   = 'var(--pp-text-primary, #111827)';
const BG     = 'var(--pp-bg, #F1FBF2)';


const sidebarBase = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--pp-sidebar-bg, #F1FBF2)',
    borderRight: '1px solid var(--pp-card-border, #D1E7DD)',
    boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'width 0.2s ease',
};


const SIDEBAR_W_EXPANDED = 240;
const SIDEBAR_W_COLLAPSED = 72;

const SidebarItem = ({ icon: Icon, label, isActive, collapsed, onClick, badge }) => (
    <button
        onClick={onClick}
        title={collapsed ? label : undefined}
        id={`sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '10px 0' : '10px 12px',
            margin: '0 8px 2px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.12s, color 0.12s',
            fontWeight: isActive ? 700 : 500,
            fontSize: 13,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            background: isActive ? BRAND : 'transparent',
            color: isActive ? '#FFFFFF' : 'var(--pp-text-secondary)',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: 'calc(100% - 16px)',
            position: 'relative'
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--pp-bg)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
        <Icon style={{ width: 18, height: 18, color: isActive ? '#FFFFFF' : BRAND, flexShrink: 0 }} />
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{label}</span>}
        {!collapsed && badge > 0 && (
            <span style={{
                background: '#EC5E27',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto'
            }}>
                {badge}
            </span>
        )}
        {collapsed && badge > 0 && (
            <span style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#EC5E27',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                width: 14,
                height: 14,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {badge}
            </span>
        )}
    </button>
);

const StoreDashboard = () => {
    const supplierCtx = useSupplierApp();
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isInitializing, setIsInitializing] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const sidebarW = sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setIsInitializing(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setProfile(null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (data) setProfile(data);
        setIsInitializing(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    if (isInitializing) {
        return (
            <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifycontent: 'center' }}>
                <MeshBackground />
                <Loader2 style={{ width: 40, height: 40, color: BRAND, animation: 'spin 1s linear infinite', marginBottom: 12, position: 'relative', zIndex: 10 }} />
                <p style={{ color: 'var(--pp-text-muted)', fontWeight: 500, position: 'relative', zIndex: 10 }}>Initializing store…</p>
            </div>
        );
    }

    if (!session) {
        return <Login onLoginSuccess={(user) => fetchProfile(user.id)} />;
    }

    if (session && !profile) {
        return (
            <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <MeshBackground />
                <div style={{ background: 'var(--pp-card-bg)', borderRadius: 24, border: '1px solid var(--pp-card-border)', boxShadow: 'var(--pp-shadow-floating)', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--pp-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Store style={{ width: 32, height: 32, color: BRAND }} />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Welcome to PetPals Store!</h2>
                    <p style={{ color: 'var(--pp-text-muted)', marginBottom: 24 }}>Your account is active, but no profile was found in the database. Contact an administrator to set up your shop access.</p>
                    <button onClick={handleLogout} style={{ background: 'var(--pp-bg)', border: '1px solid var(--pp-card-border)', borderRadius: 12, padding: '10px 20px', fontWeight: 600, color: NAVY, cursor: 'pointer', width: '100%' }}>
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    if (!supplierCtx?.clinicId) {
        return (
            <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <MeshBackground />
                <div style={{ background: 'var(--pp-card-bg)', borderRadius: 24, border: '1px solid var(--pp-card-border)', boxShadow: 'var(--pp-shadow-floating)', padding: 40, maxWidth: 400, width: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--pp-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Store style={{ width: 32, height: 32, color: BRAND }} />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 }}>No Shop Linked</h2>
                    <p style={{ color: 'var(--pp-text-muted)', marginBottom: 24 }}>Your account is signed in, but no shop has been linked to it yet. Add a row to the <code style={{ color: BRAND, background: 'var(--pp-bg)', padding: '2px 4px', borderRadius: 4 }}>shops</code> table with <code style={{ color: BRAND, background: 'var(--pp-bg)', padding: '2px 4px', borderRadius: 4 }}>owner_id</code> set to your user ID, then refresh.</p>
                    <button onClick={handleLogout} style={{ background: 'var(--pp-bg)', border: '1px solid var(--pp-card-border)', borderRadius: 12, padding: '10px 20px', fontWeight: 600, color: NAVY, cursor: 'pointer', width: '100%' }}>
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    const navigation = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'products', label: 'My Products', icon: Package },
        { id: 'new-sale', label: 'New Sale', icon: ShoppingBag },
        { id: 'online-orders', label: 'Online Orders', icon: Globe, badge: supplierCtx?.pendingOrders?.length || 0 },
        { id: 'restocking', label: 'Restocking', icon: ArrowDownToLine },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ];

    const currentTabLabel = navigation.find(n => n.id === activeTab)?.label || 'Dashboard';

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG }} className="print-hide-sidebar">
            <MeshBackground />
            
            {/* Sidebar */}
            <aside
                style={{ ...sidebarBase, width: sidebarW }}
                aria-label="Main navigation"
                className="print:hidden"
            >
                <div style={{ padding: sidebarCollapsed ? '20px 0' : '20px 16px', display: 'flex', flexDirection: sidebarCollapsed ? 'column' : 'row', gap: sidebarCollapsed ? 12 : 0, alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', borderBottom: '1px solid var(--pp-card-border)', flexShrink: 0 }}>
                    {!sidebarCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <PetPalsBrand logoSize="lg" />
                            <span style={{ fontSize: 16, fontWeight: 800, color: BRAND, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Shop App</span>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Store style={{ width: 18, height: 18, color: '#fff' }} />
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed(c => !c)}
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--pp-input-border)', background: 'var(--pp-input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: sidebarCollapsed ? 0 : 'auto', color: 'var(--pp-text-muted)' }}
                    >
                        {sidebarCollapsed ? <ChevronRightIcon size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>

                <div style={{ padding: '16px 0', flex: 1, overflowY: 'auto' }}>
                    {!sidebarCollapsed && <div style={{ padding: '0 24px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pp-text-muted)', marginBottom: 8 }}>Core Workflow</div>}
                    {navigation.slice(0, 4).map(item => (
                        <SidebarItem key={item.id} {...item} isActive={activeTab === item.id} collapsed={sidebarCollapsed} onClick={() => setActiveTab(item.id)} />
                    ))}
                    {!sidebarCollapsed && <div style={{ padding: '0 24px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pp-text-muted)', marginTop: 24, marginBottom: 8 }}>Management</div>}
                    {navigation.slice(4).map(item => (
                        <SidebarItem key={item.id} {...item} isActive={activeTab === item.id} collapsed={sidebarCollapsed} onClick={() => setActiveTab(item.id)} />
                    ))}
                </div>

                <div style={{ padding: '8px', borderTop: '1px solid var(--pp-card-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {!sidebarCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                            <span style={{ fontSize: 12, color: 'var(--pp-text-muted)', fontWeight: 500, flex: 1 }}>Theme</span>
                            <ThemeToggle />
                        </div>
                    )}

                    <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: 12, padding: '10px 12px', background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', borderRadius: 8 }}>
                        <LogOut style={{ width: 18, height: 18 }} />
                        {!sidebarCollapsed && <span style={{ fontSize: 13, fontWeight: 600 }}>Log out</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: sidebarW, transition: 'margin-left 0.2s ease', height: '100vh', overflowY: 'auto' }} className="print:!ml-0">
                {/* Top bar */}
                <header
                    role="banner"
                    style={{
                        position: 'sticky', top: 0, zIndex: 30,
                        height: 60, minHeight: 60,
                        background: 'var(--pp-header-bg)',
                        borderBottom: '1px solid var(--pp-card-border)',
                        display: 'flex', alignItems: 'center',
                        padding: '0 24px', gap: 14,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    className="print:hidden"
                >
                    {navigation.find(n => n.id === activeTab)?.icon && React.createElement(navigation.find(n => n.id === activeTab).icon, { style: { width: 18, height: 18, color: BRAND, flexShrink: 0 }, "aria-hidden": "true" })}
                    <h1
                        style={{ fontSize: 15, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap', margin: 0 }}
                        id="page-title"
                    >
                        {currentTabLabel}
                    </h1>
                    <div style={{ flex: 1 }} />
                    <span
                        style={{ fontSize: 11, fontWeight: 700, background: 'var(--pp-primary-light)', color: 'var(--pp-primary)', padding: '3px 10px', borderRadius: 99, letterSpacing: '0.03em', opacity: 0.8 }}
                        aria-label="Store is live"
                    >
                        LIVE
                    </span>
                    {/* Store owner avatar */}
                    <div
                        title={profile.user_name}
                        aria-label={`Store: ${profile.user_name}`}
                        style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: BRAND,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0,
                        }}
                    >
                        {(profile.user_name || 'S').charAt(0).toUpperCase()}
                    </div>
                </header>

                {/* Hero bar */}
                <div
                    role="region"
                    aria-label="Store hero"
                    style={{
                        background: 'linear-gradient(135deg, var(--pp-primary, #2E7D32) 0%, var(--pp-primary-deep, #1B5E20) 100%)',
                        padding: '18px 28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        flexShrink: 0,
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                    className="print:hidden"
                >
                    {/* Decorative circle behind icon */}
                    <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} aria-hidden />
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', margin: 0 }}>
                            PetPals Shop App
                        </p>
                        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#FFFFFF', margin: '3px 0 2px', letterSpacing: '-0.01em' }}>
                            {supplierCtx?.shopProfile?.name || 'My Shop'}
                        </h2>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, fontWeight: 500 }}>
                            {currentTabLabel}
                        </p>
                    </div>
                    {/* Decorative icon */}
                    <div style={{
                        width: 64, height: 64,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.12)',
                        border: '1.5px solid rgba(255,255,255,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, position: 'relative', zIndex: 1,
                    }}>
                        {React.createElement(navigation.find(n => n.id === activeTab)?.icon || Store, { 
                            style: { width: 30, height: 30, color: 'rgba(255,255,255,0.85)' }, 
                            'aria-hidden': 'true' 
                        })}
                    </div>

                </div>


                <div style={{ flex: 1, padding: '24px 32px', position: 'relative', zIndex: 1 }}>
                    {activeTab === 'dashboard' && <ShopDashboard onNavigate={setActiveTab} />}
                    {activeTab === 'products' && <ShopProducts />}
                    {activeTab === 'new-sale' && <ShopNewSale />}
                    {activeTab === 'online-orders' && <ShopOnlineOrders />}
                    {activeTab === 'restocking' && <ShopRestocking />}
                    {activeTab === 'reports' && <ShopReports />}
                    {activeTab === 'settings' && <ShopSettings />}
                </div>

            </main>

            {supplierCtx?.toasts?.length > 0 && (
                <div className="fixed bottom-6 right-6 z-[100] space-y-2 print:hidden">
                    {supplierCtx.toasts.map(toast => (
                        <div key={toast.id}
                            className={`px-5 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-right fade-in duration-300 max-w-sm ${
                                toast.type === 'error' ? 'bg-red-600 text-white' :
                                toast.type === 'warning' ? 'bg-amber-500 text-white' :
                                toast.type === 'success' ? 'bg-emerald-600 text-white' :
                                'bg-slate-800 text-white'
                            }`}>
                            {toast.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoreDashboard;
