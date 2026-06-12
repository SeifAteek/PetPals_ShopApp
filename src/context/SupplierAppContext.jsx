import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

const SupplierAppContext = createContext(null);

export const SupplierAppProvider = ({ children }) => {
    const [currentSupplier, setCurrentSupplier] = useState(null);
    // NOTE: `clinicId` actually holds the shop_id of the logged-in shop owner.
    const [clinicId, setClinicId] = useState(null);
    const [shopProfile, setShopProfile] = useState(null);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // ─── Product cache — shared across New Sale, Products, Restocking tabs ───
    const [cachedProducts, setCachedProducts] = useState([]);   // merged product+inventory list
    const [productsLoading, setProductsLoading] = useState(true);
    const fetchingProducts = useRef(false);  // prevents duplicate concurrent fetches

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

    // ─── Auth & shop detection ───────────────────────────────────────────────
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
                const { data: firstShop } = await supabase
                    .from('shops').select('shop_id, name, logo_url')
                    .limit(1)
                    .maybeSingle();
                if (firstShop) {
                    setClinicId(firstShop.shop_id);
                    setShopProfile(firstShop);
                } else {
                    setClinicId(null);
                    setShopProfile(null);
                }
            }
        };

        fetchSupplier();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) fetchSupplier();
            else { setCurrentSupplier(null); setClinicId(null); setShopProfile(null); }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── Fetch + cache products (runs once when clinicId is ready, or on refresh) ──
    const refreshProducts = useCallback(async (shopId) => {
        const id = shopId || clinicId;
        if (!id || fetchingProducts.current) return;
        fetchingProducts.current = true;
        setProductsLoading(true);
        try {
            const [{ data: prods }, { data: invItems }] = await Promise.all([
                supabase.from('products')
                    .select('product_id, name, category, price, stock_level, shop_id, image_url')
                    .eq('shop_id', id).order('name'),
                supabase.from('inventory_items')
                    .select('item_id, item_name, current_stock, low_stock_threshold, unit_price, last_restocked')
                    .eq('clinic_id', id).order('item_name'),
            ]);

            const invByName = new Map((invItems || []).map(i => [i.item_name, i]));
            const merged = (prods || []).map(p => {
                const inv = invByName.get(p.name);
                return {
                    ...p,
                    item_id: inv?.item_id,
                    current_stock: inv?.current_stock ?? p.stock_level ?? 0,
                    low_stock_threshold: inv?.low_stock_threshold ?? 10,
                    unit_price: inv?.unit_price ?? p.price,
                    last_restocked: inv?.last_restocked,
                };
            });
            setCachedProducts(merged);
        } catch (err) {
            console.error('[Context] product cache fetch error:', err);
        } finally {
            setProductsLoading(false);
            fetchingProducts.current = false;
        }
    }, [clinicId]);

    // ─── Orders / inventory badges & alerts ─────────────────────────────────
    useEffect(() => {
        if (!currentSupplier || !clinicId) return;

        const fetchData = async () => {
            const [{ data: orders }, { data: inventory }] = await Promise.all([
                supabase.from('orders').select('*')
                    .eq('shop_id', clinicId).eq('status', 'Processing')
                    .order('order_date', { ascending: false }),
                supabase.from('inventory_items').select('*')
                    .eq('clinic_id', clinicId).order('item_name'),
            ]);
            if (orders) setPendingOrders(orders);
            if (inventory) setLowStockItems(inventory.filter(i => i.current_stock < i.low_stock_threshold));
        };

        // Pre-fetch products into cache as soon as clinicId is known
        refreshProducts(clinicId);
        fetchData();

        const channel = supabase
            .channel('supplier_global_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
                fetchData();
                refreshProducts(clinicId);  // keep product cache in sync
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                refreshProducts(clinicId);
            })
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
            getNotifSettings,
            // Product cache — consumed by ShopNewSale, ShopProducts, ShopRestocking
            cachedProducts,
            productsLoading,
            refreshProducts,
        }}>
            {children}
        </SupplierAppContext.Provider>
    );
};

export const useSupplierApp = () => useContext(SupplierAppContext);
