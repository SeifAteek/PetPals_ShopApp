import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

/**
 * Enhanced Seed data for the Shop Owner Management App.
 * Seeds 16 premium products, 8 customer accounts, 15 orders, and rich expense/invoice history.
 */
async function seed() {
    console.log('=== PetPals Shop Owner Seed (Enhanced Data Entry) ===\n');

    // Step 1: Authenticate as the shop owner
    console.log('1. Logging in as shop owner...');
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'ziadhatem11204@gmail.com', password: '12345678'
    });
    if (authErr) { console.error('Login failed:', authErr.message); return; }
    const ownerId = authData.user.id;

    // Update profile to shop owner
    await supabase.from('profiles').update({
        user_type: 'Admin',
        user_name: 'Paws & Care Shop',
        email: 'owner@pawscare.eg',
        phone_number: '+20100000010'
    }).eq('user_id', ownerId);
    console.log('   ✓ Owner profile set: Paws & Care Shop');

    // Get shop for this owner
    let shopClinicId;
    const { data: existingShop } = await supabase.from('shops').select('shop_id').limit(1).single();
    if (existingShop) {
        shopClinicId = existingShop.shop_id;
        console.log('   Using existing shop:', shopClinicId.slice(0, 8));
        
        // Update the shop's owner_id and name
        await supabase.from('shops').update({
            owner_id: ownerId,
            name: 'Paws & Care Shop'
        }).eq('shop_id', shopClinicId);
        console.log('   ✓ Shop linked to owner:', ownerId);
    } else {
        console.log('   ⚠️ No shop found in shops table! Creating one...');
        const { data: newShop, error: nsErr } = await supabase.from('shops').insert({
            name: 'Paws & Care Shop',
            owner_id: ownerId,
            rating: 5,
            is_verified: true
        }).select().single();
        if (nsErr) {
            console.error('Failed to create shop:', nsErr.message);
            return;
        }
        shopClinicId = newShop.shop_id;
        console.log('   ✓ New shop created:', shopClinicId.slice(0, 8));
    }

    // Shadow clinic profile in clinics table
    const { data: clinicShadow } = await supabase.from('clinics').select('clinic_id').eq('clinic_id', shopClinicId).maybeSingle();
    if (!clinicShadow) {
        const { error: cShadowErr } = await supabase.from('clinics').insert({
            clinic_id: shopClinicId,
            name: 'Paws & Care Shop Clinic Shadow',
            owner_id: ownerId,
            location: 'Cairo, Egypt',
            phone: '+20100000010'
        });
        if (cShadowErr) {
            console.error('Failed to create clinic shadow:', cShadowErr.message);
        } else {
            console.log('   ✓ Shadow clinic profile created in clinics table');
        }
    }

    // Step 2: Seed 16 Premium Products
    console.log('\n2. Seeding 16 premium products...');
    const productsData = [
        // Vaccines
        { name: 'Rabies Vaccine (Defensor 3) 10ml', price: 340.00,  stock_level: 120, category: 'Vaccine' },
        { name: 'Feline Leukemia Vaccine (FeLV)',    price: 420.00,  stock_level: 8,   category: 'Vaccine' },
        { name: 'Canine Parvovirus Vaccine (CPV)',   price: 380.00,  stock_level: 65,  category: 'Vaccine' },
        { name: 'DHPP 5-in-1 Vaccine for Dogs',      price: 450.00,  stock_level: 80,  category: 'Vaccine' },
        // Medicine
        { name: 'Broad-Spectrum Dewormer Tablets (x10)', price: 180.00,  stock_level: 200, category: 'Medicine' },
        { name: 'Omega-3 Skin & Coat Supplement (60 caps)', price: 290.00,  stock_level: 60,  category: 'Medicine' },
        { name: 'Joint Support Glucosamine (Chews)', price: 320.00,  stock_level: 45,  category: 'Medicine' },
        { name: 'Ear Mite & Infection Drops 15ml',   price: 150.00,  stock_level: 90,  category: 'Medicine' },
        // Retail
        { name: 'Premium Dry Cat Food (Urinary Care) 2kg', price: 490.00,  stock_level: 3,   category: 'Retail' },
        { name: 'Orthopedic Memory Foam Dog Bed (L)', price: 1250.00, stock_level: 15,  category: 'Retail' },
        { name: 'Ergonomic Anti-Choke Dog Harness (M)', price: 380.00,  stock_level: 40,  category: 'Retail' },
        { name: 'Natural Tofu Cat Litter (6L)',      price: 220.00,  stock_level: 85,  category: 'Retail' },
        // Consumables
        { name: 'Sterile Surgical Sutures USP 3-0',   price: 75.00,   stock_level: 300, category: 'Consumable' },
        { name: 'Medical Latex Gloves (box/100)',     price: 190.00,  stock_level: 150, category: 'Consumable' },
        { name: 'Saline Infusion Solution 500ml',     price: 85.00,   stock_level: 5,   category: 'Consumable' },
        { name: 'Cohesive Vet Wrap Bandage (6 rolls)', price: 110.00,  stock_level: 110, category: 'Consumable' }
    ];

    // Clean existing products with same names
    for (const p of productsData) {
        await supabase.from('products').delete().eq('name', p.name);
    }

    const { data: products, error: pErr } = await supabase.from('products').insert(productsData).select();
    if (pErr) { console.error('Product insert error:', pErr.message); return; }
    console.log('   ✓', products.length, 'products inserted');

    // Step 3: Seed inventory_items matching products
    console.log('\n3. Seeding inventory items...');
    const inventoryData = products.map(p => {
        let threshold = 15;
        let costPrice = p.price * 0.6; // cost is ~60% of retail

        // Specific configurations for stock levels
        if (p.name === 'Saline Infusion Solution 500ml') {
            threshold = 25; // stock=5, threshold=25 (Critical)
            costPrice = 40.00;
        } else if (p.name === 'Feline Leukemia Vaccine (FeLV)') {
            threshold = 20; // stock=8, threshold=20 (Low)
            costPrice = 250.00;
        } else if (p.name === 'Premium Dry Cat Food (Urinary Care) 2kg') {
            threshold = 15; // stock=3, threshold=15 (Critical)
            costPrice = 300.00;
        } else if (p.name === 'Orthopedic Memory Foam Dog Bed (L)') {
            threshold = 5; costPrice = 750.00;
        }

        return {
            item_name: p.name,
            category: p.category,
            current_stock: p.stock_level,
            low_stock_threshold: threshold,
            unit_price: costPrice,
            last_restocked: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString()
        };
    });

    // Clean existing inventory items with same names
    for (const inv of inventoryData) {
        await supabase.from('inventory_items').delete().eq('item_name', inv.item_name);
    }

    const { error: iErr } = await supabase.from('inventory_items').insert(inventoryData);
    if (iErr) console.error('   ✗ Inventory error:', iErr.message);
    else console.log('   ✓', inventoryData.length, 'inventory items');

    // Step 4: Create 8 registered customer profiles
    console.log('\n4. Creating customer profiles...');
    const customerEmails = [
        { email: 'sarah.pet@example.com', name: 'Sarah Ahmed', phone: '+20100000020' },
        { email: 'mohamed.k@example.com', name: 'Mohamed Khalil', phone: '+20100000021' },
        { email: 'layla.m@example.com', name: 'Layla Mansour', phone: '+20100000022' },
        { email: 'ahmed.f@example.com', name: 'Ahmed Fathy', phone: '+20100000023' },
        { email: 'nour.h@example.com', name: 'Nour Hassan', phone: '+20100000024' },
        { email: 'yasmine.y@example.com', name: 'Yasmine Youssef', phone: '+20100000025' },
        { email: 'tarek.s@example.com', name: 'Tarek Soliman', phone: '+20100000026' },
        { email: 'hoda.e@example.com', name: 'Hoda El-Sayed', phone: '+20100000027' }
    ];

    const customers = [];
    for (const c of customerEmails) {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email: c.email, password: 'Customer123!'
        });

        let custUserId = null;
        if (signUpErr && signUpErr.message.includes('already registered')) {
            const { data: existing } = await supabase.from('profiles').select('user_id').eq('email', c.email).single();
            if (existing) custUserId = existing.user_id;
        } else if (signUpData?.user) {
            custUserId = signUpData.user.id;
            await new Promise(res => setTimeout(res, 500));
        }

        if (custUserId) {
            await supabase.from('profiles').update({
                user_name: c.name, email: c.email, phone_number: c.phone, user_type: 'Client'
            }).eq('user_id', custUserId);
            customers.push({ userId: custUserId, name: c.name, email: c.email });
            console.log('   ✓', c.name);
        } else {
            console.log('   ✗ Failed:', c.email);
        }
    }

    // Re-authenticate as owner
    await supabase.auth.signInWithPassword({ email: 'ziadhatem11204@gmail.com', password: '12345678' });

    // Step 5: Seed 15 Orders
    console.log('\n5. Seeding 15 orders...');
    const orderConfigs = [
        { status: 'Processing', custIdx: 0, daysAgo: 0, isOnline: true },
        { status: 'Processing', custIdx: 1, daysAgo: 1, isOnline: true },
        { status: 'Processing', custIdx: 2, daysAgo: 0, isOnline: true },
        { status: 'Processing', custIdx: 3, daysAgo: 2, isOnline: true },
        { status: 'Shipped',    custIdx: 4, daysAgo: 1, isOnline: true },
        { status: 'Shipped',    custIdx: 5, daysAgo: 2, isOnline: true },
        { status: 'Shipped',    custIdx: 6, daysAgo: 3, isOnline: true },
        { status: 'Delivered',  custIdx: 7, daysAgo: 4, isOnline: true },
        { status: 'Delivered',  custIdx: 0, daysAgo: 5, isOnline: true },
        { status: 'Delivered',  custIdx: 1, daysAgo: 6, isOnline: true },
        { status: 'Delivered',  custIdx: 2, daysAgo: 7, isOnline: false }, // In-store
        { status: 'Delivered',  custIdx: 3, daysAgo: 8, isOnline: false }, // In-store
        { status: 'Delivered',  custIdx: 4, daysAgo: 9, isOnline: false }, // In-store
        { status: 'Delivered',  custIdx: 5, daysAgo: 10, isOnline: false }, // In-store
        { status: 'Delivered',  custIdx: 6, daysAgo: 12, isOnline: false }  // In-store
    ];

    const orderRows = orderConfigs.map((cfg, i) => {
        const cust = customers[cfg.custIdx % customers.length];
        const totalAmount = (250 + Math.random() * 1250).toFixed(2);
        return {
            user_id: cust?.userId || ownerId,
            status: cfg.status,
            total_amount: totalAmount,
            order_date: new Date(Date.now() - cfg.daysAgo * 86400000).toISOString(),
            shipping_address: cfg.isOnline ? (cust?.name + ', Cairo, Egypt') : 'In-store',
            payment_method: cfg.isOnline ? 'Online' : 'Cash'
        };
    });

    // Clean old orders from these users
    for (const cust of customers) {
        if (cust.userId) await supabase.from('orders').delete().eq('user_id', cust.userId);
    }

    const { data: orders, error: oErr } = await supabase.from('orders').insert(orderRows).select();
    if (oErr) { console.error('Order error:', oErr.message); return; }
    console.log('   ✓', orders.length, 'orders inserted');

    // Step 6: Seed order_items (2-4 items per order)
    console.log('\n6. Seeding order items...');
    let totalItems = 0;
    for (const order of orders) {
        const numItems = 2 + Math.floor(Math.random() * 3); // 2-4 items
        const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);
        const items = shuffled.map(p => {
            const qty = 1 + Math.floor(Math.random() * 3);
            return {
                order_id: order.order_id,
                product_id: p.product_id,
                quantity: qty,
                sub_total: (p.price * qty).toFixed(2)
            };
        });
        const { error } = await supabase.from('order_items').insert(items);
        if (error) console.error('   ✗ Items for order', order.order_id.slice(0, 8), error.message);
        else totalItems += items.length;
    }
    console.log('   ✓', totalItems, 'order items');

    // Step 7: Seed invoices for delivered orders
    console.log('\n7. Seeding invoices...');
    const deliveredOrders = orders.filter(o => o.status === 'Delivered');
    const invoiceRows = deliveredOrders.map(o => ({
        clinic_id: shopClinicId,
        client_id: o.user_id !== ownerId ? o.user_id : null,
        guest_client_name: o.shipping_address === 'In-store' ? 'Walk-in' : null,
        total_amount: o.total_amount,
        status: 'Paid',
        issue_date: o.order_date
    }));

    // Add extra walk-in sales today for realistic dashboard activity
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 860.00,
        status: 'Paid', issue_date: new Date().toISOString()
    });
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 340.00,
        status: 'Paid', issue_date: new Date().toISOString()
    });
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 1250.00,
        status: 'Paid', issue_date: new Date().toISOString()
    });
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 220.00,
        status: 'Paid', issue_date: new Date().toISOString()
    });

    const { data: invoices, error: invErr } = await supabase.from('invoices').insert(invoiceRows).select();
    if (invErr) console.error('   ✗ Invoices:', invErr.message);
    else console.log('   ✓', invoices.length, 'invoices');

    // Step 8: Seed clinic_expenses (restocking cost logs)
    console.log('\n8. Seeding restock expenses...');
    const expenseRows = [
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Defensor Rabies Vaccine x100 from VetMed Solutions',
            amount: 2000.00,
            expense_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Broad-Spectrum Dewormer Tablets x150 from PharmaVet Egypt',
            amount: 1620.00,
            expense_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Orthopedic Memory Foam Dog Beds x10 from ComfortPet Ltd',
            amount: 7500.00,
            expense_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Latex Gloves x50 boxes from Medical Supply Co.',
            amount: 4750.00,
            expense_date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Natural Tofu Cat Litter x50 bags from EarthFriendly Dist.',
            amount: 6600.00,
            expense_date: new Date(Date.now() - 22 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Saline Infusion Solutions x60 bottles from Egypt Hospital Supply',
            amount: 2400.00,
            expense_date: new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]
        }
    ];

    const { error: eErr } = await supabase.from('clinic_expenses').insert(expenseRows);
    if (eErr) console.error('   ✗ Expenses:', eErr.message);
    else console.log('   ✓', expenseRows.length, 'restock expenses');

    console.log('\n=== Enhanced Shop Owner Seed Complete! ===');
    console.log('Login: ziadhatem11204@gmail.com / 12345678');
    console.log('Shop Name: Paws & Care Shop');
    console.log('clinic_id:', shopClinicId.slice(0, 8));
}

seed().catch(console.error);
