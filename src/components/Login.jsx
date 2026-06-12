import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { PetPalsBrand } from '@petpals/theme/PetPalsLogo.jsx'
import MeshBackground from '@petpals/theme/MeshBackground.jsx';
import ThemeToggle from '@petpals/theme/ThemeToggle.jsx';
import { ShoppingBag, Mail, ShieldCheck, Truck, ArrowLeft } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else if (data.user) {
            onLoginSuccess(data.user);
        }
        setLoading(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetLoading(true);
        setError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
        if (error) {
            setError(error.message);
        } else {
            setResetSent(true);
        }
        setResetLoading(false);
    };

    return (
        <div
            className="relative flex min-h-screen overflow-hidden"
            style={{ background: 'var(--pp-bg)', color: 'var(--pp-text-primary)' }}
        >
            <MeshBackground />
            
            {/* Theme toggle */}
            <div className="absolute right-5 top-5 z-20">
                <ThemeToggle />
            </div>

            {/* ── Left brand panel ── */}
            <div
                className="hidden lg:flex w-1/2 flex-col p-12 xl:p-16 relative"
                style={{ borderRight: '1px solid var(--pp-card-border)' }}
            >
                {/* Decorative gradient blobs */}
                <div
                    aria-hidden
                    className="absolute inset-0 overflow-hidden pointer-events-none opacity-60 dark:opacity-10"
                    style={{
                        background: 'linear-gradient(135deg, var(--pp-primary) 0%, var(--pp-bg) 60%, var(--pp-bg) 100%)',
                    }}
                />

                <div className="relative z-10 flex items-center gap-3">
                    <PetPalsBrand logoSize="xl" />
                </div>

                <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mt-12">
                    <div
                        className="mb-6 inline-flex w-fit items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                        style={{
                            borderRadius: 99, border: '1px solid var(--pp-card-border)',
                            background: 'var(--pp-card-bg)', color: 'var(--pp-primary)',
                        }}
                    >
                        Store OS
                    </div>
                    <h2 className="text-4xl font-black leading-tight mb-6" style={{ color: 'var(--pp-text-primary)' }}>
                        Premium pet supplies,{' '}
                        <span style={{ color: 'var(--pp-primary)' }}>
                            delivered with love.
                        </span>
                    </h2>
                    <ul className="space-y-5" style={{ color: 'var(--pp-text-secondary)' }}>
                        <li className="flex items-start gap-4">
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                                style={{ background: 'var(--pp-card-bg)', color: 'var(--pp-primary)' }}
                            >
                                <ShoppingBag className="w-4 h-4" />
                            </div>
                            <span>
                                <strong style={{ color: 'var(--pp-text-primary)' }}>Curated Products.</strong>{' '}
                                Food, toys, accessories, and health essentials for every pet.
                            </span>
                        </li>
                        <li className="flex items-start gap-4">
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                                style={{ background: 'var(--pp-card-bg)', color: 'var(--pp-primary)' }}
                            >
                                <Truck className="w-4 h-4" />
                            </div>
                            <span>
                                <strong style={{ color: 'var(--pp-text-primary)' }}>Fast Delivery.</strong>{' '}
                                Order tracking from processing to your doorstep.
                            </span>
                        </li>
                        <li className="flex items-start gap-4">
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                                style={{ background: 'var(--pp-card-bg)', color: 'var(--pp-primary)' }}
                            >
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <span>
                                <strong style={{ color: 'var(--pp-text-primary)' }}>Secure Checkout.</strong>{' '}
                                Multiple payment methods with end-to-end protection.
                            </span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-16 relative z-10">
                <div 
                    className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300"
                    style={{
                        background: 'var(--pp-card-bg)',
                        borderRadius: 24,
                        border: '1px solid var(--pp-card-border)',
                        boxShadow: 'var(--pp-shadow-floating)',
                        padding: '40px',
                    }}
                >
                    {!showReset ? (
                        <>
                            <div className="mb-8 text-center lg:text-left">
                                <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--pp-text-primary)' }}>Welcome back</h2>
                                <p style={{ color: 'var(--pp-text-secondary)', fontSize: 14 }}>Sign in to your store portal to continue.</p>
                            </div>
                            {error && (
                                <div className="flex items-center gap-3 p-4 text-sm mb-6 bg-red-50 text-red-600 border border-red-100 rounded-xl">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                                    {error}
                                </div>
                            )}
                            <form onSubmit={handleLogin} className="space-y-5" id="login-form">
                                <div>
                                    <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400" />
                                        <input 
                                            type="email" 
                                            required 
                                            id="login-email" 
                                            value={email} 
                                            onChange={(e) => setEmail(e.target.value)} 
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" 
                                            placeholder="you@example.com" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                                    <input 
                                        type="password" 
                                        required 
                                        id="login-password" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" 
                                        placeholder="••••••••" 
                                    />
                                </div>
                                <div className="flex items-center justify-end">
                                    <button 
                                        type="button" 
                                        onClick={() => { setShowReset(true); setResetEmail(email); setError(null); }} 
                                        className="text-sm font-semibold text-brand-600 hover:text-brand-500 bg-none border-none cursor-pointer p-0"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    id="login-submit" 
                                    className="btn-primary w-full py-3.5 disabled:opacity-50"
                                >
                                    {loading ? 'Authenticating...' : 'Sign In'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => { setShowReset(false); setResetSent(false); setError(null); }} 
                                className="flex items-center gap-2 mb-6 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-none border-none cursor-pointer p-0 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to sign in
                            </button>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold mb-1.5" style={{ color: 'var(--pp-text-primary)' }}>Reset password</h2>
                                <p style={{ color: 'var(--pp-text-secondary)', fontSize: 14 }}>Enter your email and we'll send a reset link.</p>
                            </div>
                            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100">{error}</div>}
                            {resetSent ? (
                                <div className="bg-emerald-50 text-emerald-700 p-5 rounded-xl border border-emerald-200 font-semibold text-sm">
                                    ✓ Reset link sent to <strong>{resetEmail}</strong>. Check your inbox.
                                </div>
                            ) : (
                                <form onSubmit={handleResetPassword} className="space-y-5">
                                    <div>
                                        <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400" />
                                            <input 
                                                type="email" 
                                                required 
                                                value={resetEmail} 
                                                onChange={(e) => setResetEmail(e.target.value)} 
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" 
                                                placeholder="you@example.com" 
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={resetLoading} 
                                        className="btn-primary w-full py-3.5 disabled:opacity-50"
                                    >
                                        {resetLoading ? 'Sending...' : 'Send Reset Link'}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
