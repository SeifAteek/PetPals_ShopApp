/**
 * PetPals Shop — Realistic Data Seed Script
 * Run with: node seed-shop-data.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wersbtloqzbpxuxxhafe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mqV0JakwJ_RyedRZtvb1Tg_Ne7Q8-zu';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── helpers ───────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, dp = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(dp));
const pickRand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();

// ─── product catalog ───────────────────────────────────────────────────────
const PRODUCTS = [
  // Vaccines
  { name: 'Rabies Vaccine 1ml',           category: 'Vaccine',    price: 85,   cost: 42,   stock: 48, threshold: 15 },
  { name: 'DHPP Combo Vaccine',           category: 'Vaccine',    price: 120,  cost: 60,   stock: 36, threshold: 12 },
  { name: 'Feline Leukemia Vaccine',      category: 'Vaccine',    price: 95,   cost: 48,   stock: 22, threshold: 10 },
  { name: 'Bordetella Intranasal',        category: 'Vaccine',    price: 70,   cost: 35,   stock: 30, threshold: 10 },
  { name: 'Leptospirosis 4-Way',          category: 'Vaccine',    price: 110,  cost: 55,   stock: 18, threshold: 8  },
  { name: 'Feline 3-in-1 FVRCP',         category: 'Vaccine',    price: 105,  cost: 52,   stock: 25, threshold: 10 },
  // Medicines
  { name: 'Amoxicillin 250mg (30 tabs)',  category: 'Medicine',   price: 65,   cost: 28,   stock: 60, threshold: 20 },
  { name: 'Metronidazole 200mg (20 tabs)',category: 'Medicine',   price: 55,   cost: 22,   stock: 45, threshold: 15 },
  { name: 'Doxycycline 100mg (14 tabs)',  category: 'Medicine',   price: 72,   cost: 32,   stock: 38, threshold: 15 },
  { name: 'Meloxicam Oral 1.5mg/ml',     category: 'Medicine',   price: 145,  cost: 70,   stock: 20, threshold: 8  },
  { name: 'Furosemide 40mg (28 tabs)',    category: 'Medicine',   price: 48,   cost: 20,   stock: 50, threshold: 20 },
  { name: 'Prednisone 5mg (30 tabs)',     category: 'Medicine',   price: 58,   cost: 24,   stock: 40, threshold: 15 },
  { name: 'Enalapril 5mg (28 tabs)',      category: 'Medicine',   price: 75,   cost: 36,   stock: 28, threshold: 10 },
  { name: 'Omeprazole 20mg (14 caps)',    category: 'Medicine',   price: 62,   cost: 28,   stock: 32, threshold: 12 },
  { name: 'Ivermectin 1% Injectable',    category: 'Medicine',   price: 95,   cost: 42,   stock: 15, threshold: 6  },
  { name: 'Enrofloxacin 50mg (10 tabs)', category: 'Medicine',   price: 88,   cost: 40,   stock: 22, threshold: 8  },
  // Consumables
  { name: 'Disposable Exam Gloves (100)',  category: 'Consumable', price: 45,  cost: 18,   stock: 80, threshold: 25 },
  { name: '3ml Syringe with Needle (50)', category: 'Consumable', price: 55,  cost: 22,   stock: 120, threshold:30 },
  { name: 'Gauze Bandage 5cm (10 rolls)', category: 'Consumable', price: 38,  cost: 14,   stock: 65, threshold: 20 },
  { name: 'Surgical Tape 2.5cm',          category: 'Consumable', price: 25,  cost: 9,    stock: 90, threshold: 30 },
  { name: 'Sterile Cotton Wool 500g',     category: 'Consumable', price: 32,  cost: 12,   stock: 55, threshold: 20 },
  { name: 'IV Catheter 22G (10pk)',       category: 'Consumable', price: 85,  cost: 38,   stock: 40, threshold: 15 },
  { name: 'Urine Dipstick Test (25pk)',   category: 'Consumable', price: 125, cost: 58,   stock: 20, threshold: 8  },
  // Retail
  { name: 'Royal Canin Puppy 2kg',        category: 'Retail',     price: 220, cost: 140,  stock: 35, threshold: 10 },
  { name: 'Royal Canin Senior Cat 1.5kg', category: 'Retail',     price: 195, cost: 120,  stock: 28, threshold: 8  },
  { name: 'Hills Science Diet Adult 3kg', category: 'Retail',     price: 285, cost: 175,  stock: 20, threshold: 6  },
  { name: 'NexGard Flea & Tick (3pk)',    category: 'Retail',     price: 180, cost: 105,  stock: 42, threshold: 12 },
  { name: 'Frontline Plus Cat (3pk)',     category: 'Retail',     price: 145, cost: 82,   stock: 38, threshold: 12 },
  { name: 'Pet Toothpaste Kit',           category: 'Retail',     price: 75,  cost: 38,   stock: 22, threshold: 8  },
  { name: 'Elizabethan Collar Medium',    category: 'Retail',     price: 55,  cost: 22,   stock: 30, threshold: 10 },
  { name: 'Digital Pet Thermometer',      category: 'Retail',     price: 95,  cost: 48,   stock: 15, threshold: 5  },
  { name: 'Pet Carrier Bag — Medium',     category: 'Retail',     price: 265, cost: 155,  stock: 8,  threshold: 3  },
  { name: 'Stainless Steel Food Bowl',    category: 'Retail',     price: 45,  cost: 20,   stock: 55, threshold: 15 },
  { name: 'Anti-scratch Deterrent Spray', category: 'Retail',     price: 88,  cost: 42,   stock: 18, threshold: 6  },
  { name: 'Dog Training Treats 200g',     category: 'Retail',     price: 55,  cost: 25,   stock: 45, threshold: 15 },
];

const CUSTOMERS = [
  'Ahmed Hassan', 'Sara Khalil', 'Mohamed Farouk', 'Nadia Youssef',
  'Khaled Ibrahim', 'Rania Mostafa', 'Tarek Salah', 'Hana Mahmoud',
  'Amira Fawzy', 'Omar Saeed', 'Dina Abdel Aziz', 'Youssef Kamel',
  'Mona Shawky', 'Sherif Nasser', 'Layla Hassan', 'Bassem Zaki',
  'Noha Amer', 'Adel Fouad', 'Rana Khairy', 'Hossam Eldin',
];

const SHIPPING_ADDRESSES = [
  'In-store', 'In-store', 'In-store', // bias toward in-store
  '12 Tahrir Sq, Cairo', '45 Corniche St, Alexandria', '8 Maadi St, Cairo',
  '23 New Cairo, 5th Settlement', '67 Zamalek, Cairo', '100 Heliopolis, Cairo',
];

async function main() {
  console.log('🌱  PetPals Shop data seeder starting…\n');

  // 1. Find the shop
  const { data: shops, error: shopErr } = await supabase.from('shops').select('shop_id, name').limit(3);
  if (shopErr || !shops?.length) {
    console.error('❌  Could not find any shops:', shopErr);
    process.exit(1);
  }
  const shop = shops[0];
  const SHOP_ID = shop.shop_id;
  console.log(`🏪  Using shop: "${shop.name}" (${SHOP_ID})\n`);

  // 2. Insert / upsert products
  console.log('📦  Upserting product catalog…');
  for (const p of PRODUCTS) {
    const { data: existing } = await supabase.from('products').select('product_id').eq('shop_id', SHOP_ID).eq('name', p.name).maybeSingle();
    if (existing) {
      await supabase.from('products').update({ price: p.price, stock_level: p.stock, category: p.category }).eq('product_id', existing.product_id);
    } else {
      await supabase.from('products').insert({ shop_id: SHOP_ID, name: p.name, price: p.price, stock_level: p.stock, category: p.category });
    }

    // inventory_items
    const { data: invEx } = await supabase.from('inventory_items').select('item_id').eq('clinic_id', SHOP_ID).eq('item_name', p.name).maybeSingle();
    if (invEx) {
      await supabase.from('inventory_items').update({ current_stock: p.stock, low_stock_threshold: p.threshold, unit_price: p.cost }).eq('item_id', invEx.item_id);
    } else {
      await supabase.from('inventory_items').insert({
        clinic_id: SHOP_ID, item_name: p.name, category: p.category,
        current_stock: p.stock, low_stock_threshold: p.threshold,
        unit_price: p.cost, last_restocked: daysAgo(rand(3, 30)),
      });
    }
    process.stdout.write('.');
  }
  console.log('\n✅  Products done.\n');

  // 3. Create invoices (past 90 days of in-store sales)
  console.log('🧾  Creating invoices (in-store sales)…');
  const invoicesToInsert = [];
  for (let day = 90; day >= 0; day--) {
    const salesCount = rand(2, 8); // 2–8 sales per day
    for (let s = 0; s < salesCount; s++) {
      const customer = pickRand(CUSTOMERS);
      const linesCount = rand(1, 4);
      let total = 0;
      for (let l = 0; l < linesCount; l++) {
        const prod = pickRand(PRODUCTS);
        const qty = rand(1, 3);
        total += prod.price * qty;
      }
      invoicesToInsert.push({
        shop_id: SHOP_ID,
        guest_client_name: customer,
        total_amount: parseFloat(total.toFixed(2)),
        status: 'Paid',
        issue_date: daysAgo(day) + '', // include time
      });
    }
  }
  // Insert in chunks of 50
  for (let i = 0; i < invoicesToInsert.length; i += 50) {
    const chunk = invoicesToInsert.slice(i, i + 50);
    const { error } = await supabase.from('invoices').insert(chunk);
    if (error) console.error('Invoice insert error:', error.message);
    process.stdout.write('.');
  }
  console.log(`\n✅  ${invoicesToInsert.length} invoices created.\n`);

  // 4. Find user profiles for online orders
  const { data: profiles } = await supabase.from('profiles').select('user_id, user_name').limit(5);

  // 5. Create online orders (past 60 days)
  console.log('🛒  Creating online orders…');
  const ORDER_STATUSES = ['Processing', 'Processing', 'Shipped', 'Delivered', 'Delivered', 'Cancelled'];
  const PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'Cash on Delivery', 'Vodafone Cash'];
  const ordersToInsert = [];
  for (let day = 60; day >= 0; day--) {
    const orderCount = rand(0, 3);
    for (let o = 0; o < orderCount; o++) {
      const linesCount = rand(1, 5);
      let total = 0;
      for (let l = 0; l < linesCount; l++) {
        const prod = pickRand(PRODUCTS);
        const qty = rand(1, 2);
        total += prod.price * qty;
      }
      const status = pickRand(ORDER_STATUSES);
      const addr = pickRand(SHIPPING_ADDRESSES);
      ordersToInsert.push({
        shop_id: SHOP_ID,
        user_id: profiles?.length ? pickRand(profiles).user_id : undefined,
        total_amount: parseFloat(total.toFixed(2)),
        status,
        order_date: daysAgo(day),
        shipping_address: addr,
        payment_method: pickRand(PAYMENT_METHODS),
      });
    }
  }
  for (let i = 0; i < ordersToInsert.length; i += 50) {
    const chunk = ordersToInsert.slice(i, i + 50).filter(o => o.user_id); // skip if no user
    if (!chunk.length) continue;
    const { error } = await supabase.from('orders').insert(chunk);
    if (error) console.error('Order insert error:', error.message);
    process.stdout.write('.');
  }
  console.log(`\n✅  ${ordersToInsert.length} orders created.\n`);

  // 6. Create expenses (inventory restocking)
  console.log('💸  Creating restocking expenses…');
  const expenses = [];
  for (let month = 2; month >= 0; month--) {
    for (const p of PRODUCTS.slice(0, 15)) {
      const qty = rand(20, 100);
      expenses.push({
        clinic_id: SHOP_ID,
        category: 'Inventory Restock',
        description: `Restock: ${p.name} ×${qty}`,
        amount: parseFloat((qty * p.cost).toFixed(2)),
        expense_date: daysAgo(rand(month * 30, (month + 1) * 30)),
      });
    }
  }
  for (let i = 0; i < expenses.length; i += 50) {
    const { error } = await supabase.from('clinic_expenses').insert(expenses.slice(i, i + 50));
    if (error) console.error('Expense insert error:', error.message);
    process.stdout.write('.');
  }
  console.log(`\n✅  ${expenses.length} expense records created.\n`);

  console.log('🎉  Seeding complete! Refresh the dashboard to see your data.\n');
}

main().catch(console.error);
