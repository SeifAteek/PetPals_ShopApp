import React, { useEffect } from 'react';
import { X, Printer, Mail, CheckCircle2, Store } from 'lucide-react';

/**
 * Shared Print Bill / Receipt Modal — used by Tab 3 (POS) and Tab 4 (Online Orders).
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   billData: {
 *     shopName: string,
 *     shopLogoUrl?: string,
 *     invoiceId: string,
 *     receiptNumber?: string,
 *     date: string,
 *     customerName: string,
 *     customerEmail?: string,
 *     channel: 'In-store' | 'Online',
 *     items: [{ name, qty, unitPrice, lineTotal }],
 *     subtotal: number,
 *     discount: number,
 *     total: number,
 *     paymentMethod: string
 *   }
 */
const PrintBillModal = ({ isOpen, onClose, billData }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !billData) return null;

    const fmt = (v) => 'EGP ' + Number(v).toFixed(2);
    const isReceipt = Boolean(billData.receiptNumber);

    const handlePrint = () => {
        window.print();
    };

    const handleEmail = () => {
        if (!billData.customerEmail) return;
        const itemLines = billData.items.map(i => `${i.name}  x${i.qty}  ${fmt(i.unitPrice)}  ${fmt(i.lineTotal)}`).join('%0A');
        const ref = billData.receiptNumber ? `Receipt ${billData.receiptNumber}` : `Bill #${(billData.invoiceId || '').slice(0, 8)}`;
        const body = `${ref}%0A` +
            `Date: ${billData.date}%0A` +
            `Customer: ${billData.customerName}%0A%0A` +
            `Items:%0A${itemLines}%0A%0A` +
            `Subtotal: ${fmt(billData.subtotal)}%0A` +
            `Discount: -${fmt(billData.discount)}%0A` +
            `TOTAL: ${fmt(billData.total)}%0A` +
            `Payment: ${billData.paymentMethod}`;
        window.open(`mailto:${billData.customerEmail}?subject=Your receipt from ${billData.shopName}&body=${body}`);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                {/* Non-printable header */}
                <div className="print-hide px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-base leading-tight">
                                {isReceipt ? 'Receipt Generated' : 'Bill / Receipt'}
                            </h3>
                            {isReceipt && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Saved to database · {billData.receiptNumber}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Printable bill content */}
                <div id="print-bill-content" className="overflow-y-auto bg-slate-50">
                    <div className="bg-white mx-4 my-5 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Branded top band */}
                        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 pt-7 pb-12 text-white relative">
                            <div className="flex items-start gap-4">
                                {billData.shopLogoUrl ? (
                                    <img
                                        src={billData.shopLogoUrl}
                                        alt={billData.shopName}
                                        crossOrigin="anonymous"
                                        className="w-14 h-14 rounded-xl object-cover bg-white/95 p-1 ring-2 ring-white/50 shadow-sm shrink-0"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-white/95 flex items-center justify-center shadow-sm shrink-0 ring-2 ring-white/50">
                                        <Store className="w-7 h-7 text-emerald-600" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">
                                        {isReceipt ? 'Official Receipt' : 'Sales Bill'}
                                    </p>
                                    <h2 className="text-xl font-black truncate leading-tight mt-0.5">{billData.shopName}</h2>
                                    <p className="text-[11px] text-emerald-50/90 mt-1">{billData.date}</p>
                                </div>
                            </div>
                        </div>

                        {/* Receipt number ribbon */}
                        <div className="-mt-7 mx-5 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Receipt No.</p>
                                <p className="text-sm font-black text-slate-900 font-mono mt-0.5">
                                    {billData.receiptNumber || `BILL-${(billData.invoiceId || 'NA').slice(0, 8).toUpperCase()}`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Channel</p>
                                <p className="text-xs font-bold text-slate-700 mt-0.5">{billData.channel}</p>
                            </div>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Customer info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Billed To</p>
                                    <p className="text-sm font-bold text-slate-800 truncate">{billData.customerName}</p>
                                    {billData.customerEmail && (
                                        <p className="text-[11px] text-slate-500 truncate">{billData.customerEmail}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment</p>
                                    <p className="text-sm font-bold text-slate-800">{billData.paymentMethod}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="border-t border-slate-100 pt-4">
                                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                                    <div className="col-span-6">Item</div>
                                    <div className="col-span-2 text-center">Qty</div>
                                    <div className="col-span-2 text-right">Unit</div>
                                    <div className="col-span-2 text-right">Amount</div>
                                </div>
                                <div className="divide-y divide-dashed divide-slate-200">
                                    {billData.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 text-sm py-2.5 px-1">
                                            <div className="col-span-6 font-medium text-slate-800 truncate pr-2">{item.name}</div>
                                            <div className="col-span-2 text-center text-slate-600">{item.qty}</div>
                                            <div className="col-span-2 text-right text-slate-500 text-xs tabular-nums">{fmt(item.unitPrice)}</div>
                                            <div className="col-span-2 text-right font-semibold text-slate-900 tabular-nums">{fmt(item.lineTotal)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="border-t-2 border-dashed border-slate-300 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-semibold text-slate-700 tabular-nums">{fmt(billData.subtotal)}</span>
                                </div>
                                {billData.discount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Discount</span>
                                        <span className="font-semibold text-rose-600 tabular-nums">-{fmt(billData.discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end pt-3 border-t border-slate-200">
                                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Paid</span>
                                    <span className="text-2xl font-black text-emerald-600 tabular-nums leading-none">{fmt(billData.total)}</span>
                                </div>
                            </div>

                            {/* Footer note */}
                            <div className="border-t border-dashed border-slate-200 pt-4 text-center">
                                <p className="text-[10px] text-slate-400 tracking-wide">
                                    Thank you for shopping with {billData.shopName}.
                                </p>
                                <p className="text-[9px] text-slate-300 mt-1">
                                    Generated {new Date().toLocaleString()} · PetPals
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Non-printable actions */}
                <div className="print-hide px-5 py-4 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0">
                    <button onClick={handlePrint}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-colors shadow-sm">
                        <Printer className="w-4 h-4" /> Print / Save PDF
                    </button>
                    {billData.customerEmail && (
                        <button onClick={handleEmail}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm transition-colors">
                            <Mail className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onClose}
                        className="px-4 py-2.5 text-slate-500 hover:text-slate-700 font-semibold text-sm transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrintBillModal;
