import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

/**
 * Seed data for the Shop Owner Management App.
 * Uses only existing tables & columns. Zero new tables or columns.
 */
async function seed() {
    console.log('=== PetPals Shop Owner Seed ===\n');

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
    } else {
        console.log('   ⚠️ No shop found in shops table! You must manually insert a row in the Supabase Dashboard.');
        return;
    }

    // Step 2: Seed 10 Products
    console.log('\n2. Seeding 10 products...');
    const productsData = [
        { name: 'Rabies Vaccine 5ml',         price: 8.50,  stock_level: 120, category: 'Vaccine' },
        { name: 'Distemper Vaccine',           price: 11.00, stock_level: 8,   category: 'Vaccine' },
        { name: 'Omega-3 Supplement 60 caps',  price: 14.99, stock_level: 60,  category: 'Medicine' },
        { name: 'Deworming Tablets x10',       price: 4.50,  stock_level: 200, category: 'Medicine' },
        { name: 'Premium Dry Cat Food 2kg',    price: 18.00, stock_level: 3,   category: 'Retail' },
        { name: 'Dog Collar Size M',           price: 6.00,  stock_level: 90,  category: 'Retail' },
        { name: 'Pet Shampoo 250ml',           price: 7.25,  stock_level: 55,  category: 'Retail' },
        { name: 'Surgical Bandages (roll)',     price: 1.80,  stock_level: 300, category: 'Consumable' },
        { name: 'Latex Gloves box/100',        price: 6.40,  stock_level: 150, category: 'Consumable' },
        { name: 'Saline Solution 500ml',       price: 3.20,  stock_level: 5,   category: 'Consumable' }
    ];

    // Clean existing products with same names
    for (const p of productsData) {
        await supabase.from('products').delete().eq('name', p.name);
    }

    const { data: products, error: pErr } = await supabase.from('products').insert(productsData).select();
    if (pErr) { console.error('Product insert error:', pErr.message); return; }
    console.log('   ✓', products.length, 'products inserted');

    // Step 3: Seed inventory_items — 3 items intentionally below threshold
    console.log('\n3. Seeding inventory items...');
    const inventoryData = products.map(p => {
        let threshold = 10;
        let costPrice = p.price * 0.6; // cost is ~60% of selling price

        // Make specific items low/critical
        if (p.name === 'Saline Solution 500ml') {
            threshold = 20; // stock=5, threshold=20 → critical
            costPrice = 1.60;
        } else if (p.name === 'Distemper Vaccine') {
            threshold = 20; // stock=8, threshold=20 → low
            costPrice = 6.50;
        } else if (p.name === 'Premium Dry Cat Food 2kg') {
            threshold = 15; // stock=3, threshold=15 → critical
            costPrice = 11.00;
        } else if (p.name === 'Rabies Vaccine 5ml') {
            threshold = 15; costPrice = 4.50;
        } else if (p.name === 'Omega-3 Supplement 60 caps') {
            threshold = 10; costPrice = 8.00;
        } else if (p.name === 'Deworming Tablets x10') {
            threshold = 20; costPrice = 2.00;
        } else if (p.name === 'Dog Collar Size M') {
            threshold = 10; costPrice = 2.80;
        } else if (p.name === 'Pet Shampoo 250ml') {
            threshold = 8; costPrice = 3.50;
        } else if (p.name === 'Surgical Bandages (roll)') {
            threshold = 30; costPrice = 0.90;
        } else if (p.name === 'Latex Gloves box/100') {
            threshold = 20; costPrice = 3.50;
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

    // Step 4: Create 5 registered customer profiles
    console.log('\n4. Creating customer profiles...');
    const customerEmails = [
        { email: 'sarah.pet@example.com', name: 'Sarah Ahmed', phone: '+20100000020' },
        { email: 'mohamed.k@example.com', name: 'Mohamed Khalil', phone: '+20100000021' },
        { email: 'layla.m@example.com', name: 'Layla Mansour', phone: '+20100000022' },
        { email: 'ahmed.f@example.com', name: 'Ahmed Fathy', phone: '+20100000023' },
        { email: 'nour.h@example.com', name: 'Nour Hassan', phone: '+20100000024' }
    ];

    const customers = [];
    for (const c of customerEmails) {
        // Try to sign up (if already exists, find by email)
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

    // Step 5: Seed 8 orders — mix of statuses
    console.log('\n5. Seeding 8 orders...');
    const orderConfigs = [
        { status: 'Processing', custIdx: 0, daysAgo: 0, isOnline: true },
        { status: 'Processing', custIdx: 1, daysAgo: 1, isOnline: true },
        { status: 'Processing', custIdx: 2, daysAgo: 0, isOnline: true },
        { status: 'Shipped', custIdx: 3, daysAgo: 2, isOnline: true },
        { status: 'Shipped', custIdx: 4, daysAgo: 3, isOnline: true },
        { status: 'Delivered', custIdx: 0, daysAgo: 5, isOnline: true },
        { status: 'Delivered', custIdx: 1, daysAgo: 7, isOnline: false },  // In-store
        { status: 'Delivered', custIdx: 2, daysAgo: 10, isOnline: false }, // In-store
    ];

    const orderRows = orderConfigs.map((cfg, i) => {
        const cust = customers[cfg.custIdx % customers.length];
        const totalAmount = (20 + Math.random() * 80).toFixed(2);
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

    // Step 6: Seed order_items — 2-4 items per order
    console.log('\n6. Seeding order items...');
    let totalItems = 0;
    for (const order of orders) {
        const numItems = 2 + Math.floor(Math.random() * 3); // 2-4 items
        const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);
        const items = shuffled.map(p => {
            const qty = 1 + Math.floor(Math.random() * 5);
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

    // Step 7: Seed invoices — one per delivered order
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

    // Add a few more today's invoices for dashboard KPIs
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 42.50,
        status: 'Paid', issue_date: new Date().toISOString()
    });
    invoiceRows.push({
        clinic_id: shopClinicId, client_id: null,
        guest_client_name: 'Walk-in', total_amount: 18.75,
        status: 'Paid', issue_date: new Date().toISOString()
    });

    const { data: invoices, error: invErr } = await supabase.from('invoices').insert(invoiceRows).select();
    if (invErr) console.error('   ✗ Invoices:', invErr.message);
    else console.log('   ✓', invoices.length, 'invoices');

    // Step 8: Seed clinic_expenses — 4 restock entries
    console.log('\n8. Seeding restock expenses...');
    const expenseRows = [
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Rabies Vaccine 5ml x50 from VetMed Supplies. Monthly restock',
            amount: 225.00,
            expense_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Deworming Tablets x10 x100 from PharmaVet. Bulk purchase',
            amount: 200.00,
            expense_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Latex Gloves box/100 x30 from MedSupply Co. Regular order',
            amount: 105.00,
            expense_date: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0]
        },
        {
            clinic_id: shopClinicId,
            category: 'Inventory Restock',
            description: 'Restock: Surgical Bandages (roll) x100 from BandagePro. Warehouse deal',
            amount: 90.00,
            expense_date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0]
        }
    ];

    const { error: eErr } = await supabase.from('clinic_expenses').insert(expenseRows);
    if (eErr) console.error('   ✗ Expenses:', eErr.message);
    else console.log('   ✓', expenseRows.length, 'restock expenses');

    console.log('\n=== Shop Owner Seed Complete! ===');
    console.log('Login: ziadhatem11204@gmail.com / 12345678');
    console.log('Shop Name: Paws & Care Shop');
    console.log('user_type: Admin (shop owner)');
    console.log('clinic_id:', shopClinicId.slice(0, 8));
    console.log('\nLow stock items to check:');
    console.log('  - Saline Solution 500ml: stock=5, threshold=20 (Critical)');
    console.log('  - Premium Dry Cat Food 2kg: stock=3, threshold=15 (Critical)');
    console.log('  - Distemper Vaccine: stock=8, threshold=20 (Low)');
}

seed().catch(console.error);
