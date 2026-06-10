import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useSupplierApp } from '../context/SupplierAppContext';
import { PetPalsBrand } from '@petpals/theme/PetPalsLogo.jsx'
import MeshBackground from '@petpals/theme/MeshBackground.jsx';
import ThemeToggle from '@petpals/theme/ThemeToggle.jsx';
import {
    LayoutDashboard, Package, ShoppingBag, Globe, ArrowDownToLine,
    BarChart3, Settings as SettingsIcon, LogOut, Loader2, Store
} from 'lucide-react';

import Login from './Login';

import ShopDashboard from './ShopDashboard';
import ShopProducts from './ShopProducts';
import ShopNewSale from './ShopNewSale';
import ShopOnlineOrders from './ShopOnlineOrders';
import ShopRestocking from './ShopRestocking';
import ShopReports from './ShopReports';
import ShopSettings from './ShopSettings';

const SidebarItem = ({ icon: Icon, label, isActive, onClick, badge }) => (
    <button
        onClick={onClick}
        id={`sidebar-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition-all duration-200 ${
            isActive ? 'pp-nav-active' : 'pp-nav-idle'
        }`}
    >
        <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
        <span className="text-sm">{label}</span>
        {badge > 0 && (
            <span className="ml-auto bg-tangerine-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
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
            <div className="relative flex min-h-screen flex-col items-center justify-center">
                <MeshBackground />
                <Loader2 className="relative z-10 mb-4 h-10 w-10 animate-spin text-brand-500" />
                <h2 className="relative z-10 animate-pulse text-lg font-medium text-[var(--pp-text-muted)]">Initializing store…</h2>
            </div>
        );
    }

    if (!session) {
        return <Login onLoginSuccess={(user) => fetchProfile(user.id)} />;
    }

    if (session && !profile) {
        return (
            <div className="relative flex min-h-screen items-center justify-center p-8">
                <MeshBackground />
                <div className="pp-card relative z-10 max-w-md w-full p-8 text-center">
                    <Store className="w-16 h-16 text-brand-200 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to PetPals Store!</h2>
                    <p className="text-slate-500 mb-8">Your account is active, but no profile was found in the database. Contact an administrator to set up your shop access.</p>
                    <button onClick={handleLogout} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors">
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    if (!supplierCtx?.clinicId) {
        return (
            <div className="relative flex min-h-screen items-center justify-center p-8">
                <MeshBackground />
                <div className="pp-card relative z-10 max-w-md w-full p-8 text-center">
                    <Store className="w-16 h-16 text-brand-200 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">No Shop Linked</h2>
                    <p className="text-slate-500 mb-8">Your account is signed in, but no shop has been linked to it yet. Add a row to the <code className="text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">shops</code> table with <code className="text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">owner_id</code> set to your user ID, then refresh.</p>
                    <button onClick={handleLogout} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors">
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
        <div className="pp-app-frame print-hide-sidebar">
            <MeshBackground />
            <aside className="pp-sidebar pp-sidebar--panel flex flex-col print:hidden">
                <div className="border-b border-[var(--pp-card-border)] p-6">
                    <PetPalsBrand logoSize="md" badge="Store" />
                    <p className="mt-3 truncate text-sm font-medium text-[var(--pp-text-secondary)]">{profile.user_name || 'Shop Owner'}</p>
                </div>

                <div className="px-4 py-2 flex-1 overflow-y-auto space-y-1">
                    {navigation.map(item => (
                        <SidebarItem
                            key={item.id} icon={item.icon} label={item.label}
                            isActive={activeTab === item.id}
                            onClick={() => setActiveTab(item.id)}
                            badge={item.badge}
                        />
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200">
                            {(profile.user_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-slate-800 truncate">{profile.user_name}</p>
                            <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="pp-nav-idle w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:!text-red-600 hover:!bg-red-500/10 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="pp-main-area flex flex-1 flex-col print:!ml-0">
                <header className="pp-header pp-header--float flex shrink-0 items-center print:hidden">
                    <h2 className="text-lg font-semibold">{currentTabLabel}</h2>
                    <div className="ml-auto flex items-center gap-4">
                        <ThemeToggle />
                        <div className="pp-liquid-glass pp-liquid-glass--pill pp-liquid-glass--resting flex h-8 w-8 items-center justify-center text-sm font-bold">
                            {(profile.user_name || 'S').charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <div className="pp-content-scroll flex-1 px-4 pb-6 md:px-6">
                    <div className="max-w-7xl mx-auto h-full flex flex-col">
                        {activeTab === 'dashboard' && <ShopDashboard onNavigate={setActiveTab} />}
                        {activeTab === 'products' && <ShopProducts />}
                        {activeTab === 'new-sale' && <ShopNewSale />}
                        {activeTab === 'online-orders' && <ShopOnlineOrders />}
                        {activeTab === 'restocking' && <ShopRestocking />}
                        {activeTab === 'reports' && <ShopReports />}
                        {activeTab === 'settings' && <ShopSettings />}
                    </div>
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
