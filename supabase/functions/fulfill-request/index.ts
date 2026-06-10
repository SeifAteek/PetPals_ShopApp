import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }});
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { order_id } = await req.json();

        if (!order_id) {
            return new Response(JSON.stringify({ error: 'Missing order_id' }), { status: 400 });
        }

        // Fetch the order and items
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('user_id, status, order_items(product_id, quantity, products(name))')
            .eq('order_id', order_id)
            .single();

        if (orderError) throw orderError;
        if (order.status === 'Delivered') {
            return new Response(JSON.stringify({ message: 'Already delivered' }), { status: 200 });
        }

        const requesterId = order.user_id;

        // Fetch supplier (we assume the user with user_type = Supplier)
        const { data: supplierProfile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('user_type', 'Supplier')
            .single();
        
        if (!supplierProfile) throw new Error("Supplier profile not found");
        const supplierId = supplierProfile.user_id;

        // Fetch current inventory for supplier and requester
        const itemNames = order.order_items.map(item => item.products.name);
        
        const { data: inventory, error: invError } = await supabase
            .from('inventory_items')
            .select('item_id, clinic_id, item_name, current_stock')
            .in('item_name', itemNames)
            .in('clinic_id', [supplierId, requesterId]);

        if (invError) throw invError;

        // Execute sequentially to simulate a basic transaction (since REST API doesn't support transactions easily)
        // Note: For true ACID transaction, we should use a Postgres function via RPC. 
        // We will execute them and if any fail, we might have partial success, but since we use RPC for transactions in real life, 
        // this edge function is a mock of atomic behavior using sequential awaits. 
        // Best approach: create a Postgres function and call it via RPC. But the prompt specifically asks to loop in the Edge Function.
        
        for (const orderItem of order.order_items) {
            const itemName = orderItem.products.name;
            const qty = orderItem.quantity;

            const supItem = inventory.find(i => i.clinic_id === supplierId && i.item_name === itemName);
            const reqItem = inventory.find(i => i.clinic_id === requesterId && i.item_name === itemName);

            if (supItem) {
                const { error: err1 } = await supabase
                    .from('inventory_items')
                    .update({ current_stock: Math.max(0, supItem.current_stock - qty) })
                    .eq('item_id', supItem.item_id);
                if (err1) throw err1;
            }

            if (reqItem) {
                const { error: err2 } = await supabase
                    .from('inventory_items')
                    .update({ current_stock: reqItem.current_stock + qty })
                    .eq('item_id', reqItem.item_id);
                if (err2) throw err2;
            }
        }

        // Finally, update the order status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ status: 'Delivered' })
            .eq('order_id', order_id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            status: 500,
        });
    }
});
