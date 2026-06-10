import { supabase } from '../supabaseClient';

/**
 * Insert a receipt row after a payment is confirmed.
 * The DB trigger `receipts_set_number` populates `receipt_number` automatically.
 *
 * @param {Object} params
 * @param {'shop_pos'|'shop_online_order'} params.source
 * @param {string} params.shopId
 * @param {string} [params.invoiceId]
 * @param {string} [params.orderId]
 * @param {string} [params.clientId]
 * @param {string} [params.guestClientName]
 * @param {string} [params.paymentMethod]            'Card' | 'Cash' | 'Online' | etc.
 * @param {'Paid'|'Pending'|'Refunded'} [params.paymentStatus]
 * @param {number} [params.subtotal]
 * @param {number} [params.discount]
 * @param {number} params.totalAmount
 * @param {Object} [params.itemsSnapshot]            JSON snapshot of line items
 * @param {string} [params.issuedBy]                 user_id of the cashier / shop owner
 * @param {string} [params.notes]
 * @returns {Promise<Object|null>} The inserted receipt row, or null on failure.
 */
export async function createShopReceipt({
    source,
    shopId,
    invoiceId = null,
    orderId = null,
    clientId = null,
    guestClientName = null,
    paymentMethod = null,
    paymentStatus = 'Paid',
    subtotal = null,
    discount = 0,
    totalAmount,
    itemsSnapshot = null,
    issuedBy = null,
    notes = null,
}) {
    if (!shopId || totalAmount == null) {
        console.warn('createShopReceipt: missing shopId or totalAmount, skipping.');
        return null;
    }

    const { data, error } = await supabase
        .from('receipts')
        .insert({
            source,
            shop_id: shopId,
            invoice_id: invoiceId,
            order_id: orderId,
            client_id: clientId,
            guest_client_name: guestClientName,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            subtotal,
            discount,
            total_amount: totalAmount,
            items_snapshot: itemsSnapshot,
            issued_by: issuedBy,
            notes,
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to save receipt:', error);
        return null;
    }
    return data;
}
