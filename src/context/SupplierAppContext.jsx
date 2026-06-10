import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const SupplierAppContext = createContext(null);

export const SupplierAppProvider = ({ children }) => {
    const [currentSupplier, setCurrentSupplier] = useState(null);
    // NOTE: `clinicId` actually holds the shop_id of the logged-in shop owner.
    // Shops reuse clinic-scoped tables (inventory_items, invoices, clinic_expenses)
    // by storing shop_id in the clinic_id column. Variable kept for back-compat.
    const [clinicId, setClinicId] = useState(null);
    const [shopProfile, setShopProfile] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = useCallback(() => setRefreshTrigger(p => p + 1), []);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    const getNotifSettings = useCallback(() => {
        if (!currentSupplier) return { newOnlineOrder: true, lowStock: true, outOfStock: true, restockLogged: true };
        const stored = localStorage.getItem('shop_notif_' + currentSupplier.user_id);
        if (stored) try { return JSON.parse(stored); } catch (e) {}
        return { newOnlineOrder: true, lowStock: true, outOfStock: true, restockLogged: true };
    }, [currentSupplier]);

    const checkStockAlerts = useCallback(async (items) => {
        const settings = getNotifSettings();
        const globalThreshold = currentSupplier 
            ? localStorage.getItem('shop_global_threshold_' + currentSupplier.user_id) 
            : null;
        
        for (const item of items) {
            const threshold = globalThreshold ? parseInt(globalThreshold, 10) : item.low_stock_threshold;
            if (item.current_stock === 0 && settings.outOfStock) {
                addToast(`🚨 Out of stock: ${item.item_name}`, 'error');
            } else if (item.current_stock < threshold && settings.lowStock) {
                addToast(`⚠️ Low stock: ${item.item_name} — only ${item.current_stock} units left.`, 'warning');
            }
        }
    }, [addToast, getNotifSettings, currentSupplier]);

    useEffect(() => {
        const fetchSupplier = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setCurrentSupplier(null);
                setClinicId(null);
                setShopProfile(null);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles').select('*').eq('user_id', session.user.id).single();
            if (!profile) return;

            setCurrentSupplier(profile);

            const { data: ownedShop } = await supabase
                .from('shops').select('shop_id, name, logo_url')
                .eq('owner_id', session.user.id)
                .maybeSingle();

            if (ownedShop) {
                setClinicId(ownedShop.shop_id);
                setShopProfile(ownedShop);
            } else {
                setClinicId(null);
                setShopProfile(null);
            }
        };

        fetchSupplier();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) fetchSupplier();
            else { setCurrentSupplier(null); setClinicId(null); setShopProfile(null); }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch pending orders and low stock items
    useEffect(() => {
        if (!currentSupplier || !clinicId) return;

        const fetchData = async () => {
            // Orders scoped to current shop. Requires `orders.shop_id` migration;
            // otherwise this returns nothing (safe-by-default vs leaking globally).
            const { data: orders } = await supabase
                .from('orders').select('*')
                .eq('shop_id', clinicId)
                .eq('status', 'Processing')
                .order('order_date', { ascending: false });
            if (orders) setPendingOrders(orders);

            const { data: inventory } = await supabase
                .from('inventory_items').select('*')
                .eq('clinic_id', clinicId)
                .order('item_name');
            if (inventory) {
                const low = inventory.filter(i => i.current_stock < i.low_stock_threshold);
                setLowStockItems(low);
            }
        };

        fetchData();

        const channel = supabase
            .channel('supplier_global_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => fetchData())
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [currentSupplier, clinicId, refreshTrigger]);

    return (
        <SupplierAppContext.Provider value={{
            currentSupplier,
            clinicId,
            shopProfile,
            pendingOrders,
            lowStockItems,
            toasts,
            addToast,
            triggerRefresh,
            refreshTrigger,
            checkStockAlerts,
            getNotifSettings
        }}>
            {children}
        </SupplierAppContext.Provider>
    );
};

export const useSupplierApp = () => useContext(SupplierAppContext);
