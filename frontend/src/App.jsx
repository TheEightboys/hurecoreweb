import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as api from './api';
import { PLAN_CONFIG, getPlanLabel, getModulesLabel, calculateBundlePrice } from './plans';

/**
 * HURE SuperAdmin Dashboard
 * Connected to backend API
 */
export default function HureSuperadminApp() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());

    // Data state
    const [clinics, setClinics] = useState([]);
    const [pendingClinics, setPendingClinics] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [promos, setPromos] = useState([]);
    const [audit, setAudit] = useState([]);
    const [apiLogs, setApiLogs] = useState([]);
    const [siteContent, setSiteContent] = useState({});
    const [stats, setStats] = useState({});

    // UI state
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [selectedClinicId, setSelectedClinicId] = useState(null);
    const [pendingFilter, setPendingFilter] = useState('');
    const [clinicFilter, setClinicFilter] = useState('all');
    const [auditFilterType, setAuditFilterType] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch data on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadDashboardData();
        }
    }, [isAuthenticated]);

    // Load all dashboard data
    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [clinicsRes, subsRes, txRes, promosRes, auditRes, contentRes] = await Promise.all([
                api.getClinics(),
                api.getSubscriptions(),
                api.getTransactions(),
                api.getPromos(),
                api.getAuditLogs({ limit: 100 }),
                api.getSiteContent()
            ]);

            const allClinics = clinicsRes.clinics || [];
            setClinics(allClinics.filter(c => c.status === 'active' || c.status === 'suspended'));
            setPendingClinics(allClinics.filter(c => c.status.startsWith('pending') || c.status === 'rejected'));
            setSubscriptions(subsRes.subscriptions || []);
            setTransactions(txRes.transactions || []);
            setPromos(promosRes.promos || []);
            setAudit(auditRes.logs || []);
            setSiteContent(contentRes || {});

            // Calculate stats
            setStats({
                total: allClinics.length,
                pending: allClinics.filter(c => c.status.startsWith('pending')).length,
                active: allClinics.filter(c => c.status === 'active').length,
                bundles: allClinics.filter(c => c.is_bundle).length,
                careOnly: allClinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'care').length
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Demo login (for development)
    const handleDemoLogin = useCallback(() => {
        // Generate a demo token for testing
        const demoToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNhZG1pbi1kZW1vIiwiZW1haWwiOiJhZG1pbkBodXJlLmNvbSIsInJvbGUiOiJzdXBlcmFkbWluIiwibmFtZSI6IlN1cGVyQWRtaW4gRGVtbyJ9.demo';
        api.setToken(demoToken);
        setIsAuthenticated(true);
    }, []);

    // Clinic actions
    const handleActivateClinic = async (id) => {
        try {
            const result = await api.activateClinic(id);
            loadDashboardData();
            // Show first-login URL for testing (when using Resend test mode)
            if (result.firstLoginUrl) {
                const useLink = confirm(
                    `Clinic activated!\n\n` +
                    `First-login URL (for testing - copy this link):\n${result.firstLoginUrl}\n\n` +
                    `Click OK to open the first-login page, or Cancel to copy the URL.`
                );
                if (useLink) {
                    window.open(result.firstLoginUrl, '_blank');
                } else {
                    navigator.clipboard.writeText(result.firstLoginUrl);
                    alert('URL copied to clipboard!');
                }
            }
        } catch (err) {
            alert('Failed to activate: ' + err.message);
        }
    };

    const handleSuspendClinic = async (id) => {
        const reason = prompt('Reason for suspension (optional):');
        try {
            await api.suspendClinic(id, reason);
            loadDashboardData();
        } catch (err) {
            alert('Failed to suspend: ' + err.message);
        }
    };

    const handleRejectClinic = async (id) => {
        const reason = prompt('Reason for rejection (optional):');
        try {
            await api.rejectClinic(id, reason);
            loadDashboardData();
        } catch (err) {
            alert('Failed to reject: ' + err.message);
        }
    };

    // Promo actions
    const handleCreatePromo = async (code, discountPercent, expiresAt) => {
        try {
            await api.createPromo({ code, discountPercent, expiresAt });
            loadDashboardData();
        } catch (err) {
            alert('Failed to create promo: ' + err.message);
        }
    };

    const handleTogglePromo = async (id) => {
        try {
            await api.togglePromo(id);
            loadDashboardData();
        } catch (err) {
            alert('Failed to toggle promo: ' + err.message);
        }
    };

    // Site content update
    const handleUpdateSiteContent = async (key, value) => {
        try {
            await api.updateSiteContent({ [key]: value });
            setSiteContent(prev => ({ ...prev, [key]: value }));
        } catch (err) {
            alert('Failed to update: ' + err.message);
        }
    };

    // Computed values
    const selectedClinic = useMemo(
        () => clinics.find(c => c.id === selectedClinicId) || null,
        [clinics, selectedClinicId]
    );

    const filteredPending = useMemo(() => {
        if (!pendingFilter) return pendingClinics;
        return pendingClinics.filter(p => p.status === pendingFilter);
    }, [pendingClinics, pendingFilter]);

    const filteredClinics = useMemo(() => {
        if (clinicFilter === 'all') return clinics;
        if (clinicFilter === 'bundle') return clinics.filter(c => c.is_bundle);
        if (clinicFilter === 'core') return clinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'core');
        if (clinicFilter === 'care') return clinics.filter(c => c.modules?.length === 1 && c.modules[0] === 'care');
        return clinics;
    }, [clinics, clinicFilter]);

    const filteredAudit = useMemo(() => {
        if (auditFilterType === 'all') return audit;
        return audit.filter(a => a.type === auditFilterType);
    }, [audit, auditFilterType]);

    const uniqueAuditTypes = useMemo(() =>
        [...new Set(audit.map(a => a.type))],
        [audit]
    );

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <div className="text-center mb-6">
                        <div className="text-emerald-700 font-bold text-xl">HURE</div>
                        <div className="text-lg font-semibold">SuperAdmin Login</div>
                    </div>
                    <button
                        onClick={handleDemoLogin}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                    >
                        Enter Demo Mode
                    </button>
                    <p className="text-xs text-slate-500 mt-4 text-center">
                        Demo mode uses a test token. In production, implement proper auth.
                    </p>
                    <div className="mt-6 text-center">
                        <a href="/" className="text-emerald-600 hover:underline text-sm">
                            ← Back to Homepage
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Stat Card Component
    const StatCard = ({ label, value }) => (
        <div className="bg-white border rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-semibold mt-1">{value}</div>
        </div>
    );

    // Dashboard Tab
    const DashboardTab = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total clinics" value={stats.total || 0} />
                <StatCard label="Active clinics" value={stats.active || 0} />
                <StatCard label="Active bundles" value={stats.bundles || 0} />
                <StatCard label="Care-only" value={stats.careOnly || 0} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4">
                    <h2 className="font-semibold text-sm mb-2">Core Plans</h2>
                    <div className="space-y-2 text-sm">
                        {Object.entries(PLAN_CONFIG.core).map(([key, cfg]) => (
                            <div key={key} className="flex justify-between">
                                <span>{cfg.label}</span>
                                <span className="text-slate-600">
                                    KSh {cfg.price.toLocaleString()} · {cfg.maxStaff} staff
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white border rounded-lg p-4">
                    <h2 className="font-semibold text-sm mb-2">Care Plans</h2>
                    <div className="space-y-2 text-sm">
                        {Object.entries(PLAN_CONFIG.care).map(([key, cfg]) => (
                            <div key={key} className="flex justify-between">
                                <span>{cfg.label}</span>
                                <span className="text-slate-600">
                                    KSh {cfg.price.toLocaleString()} · Unlimited staff
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white border rounded-lg p-4">
                <h2 className="font-semibold text-sm mb-2">Recent Audit Events</h2>
                <ul className="text-sm max-h-40 overflow-auto">
                    {audit.slice(0, 5).map(item => (
                        <li key={item.id} className="py-2 border-b last:border-b-0">
                            <div className="font-medium">{item.type}</div>
                            <div className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</div>
                        </li>
                    ))}
                    {audit.length === 0 && (
                        <li className="text-xs text-slate-500">No audit events yet.</li>
                    )}
                </ul>
            </div>
        </div>
    );

    // Pending Tab
    const PendingTab = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Pending Clinics</h2>
                <select
                    className="border rounded px-2 py-1 text-xs"
                    value={pendingFilter}
                    onChange={e => setPendingFilter(e.target.value)}
                >
                    <option value="">All</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="pending_activation">Pending Activation</option>
                </select>
            </div>
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                        <tr>
                            <th className="px-3 py-2">Clinic</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Modules</th>
                            <th className="px-3 py-2">Plan</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPending.map(p => (
                            <tr key={p.id} className="border-t">
                                <td className="px-3 py-2">{p.name}</td>
                                <td className="px-3 py-2 text-xs">{p.email}</td>
                                <td className="px-3 py-2 text-xs">{getModulesLabel(p.modules || [], p.is_bundle)}</td>
                                <td className="px-3 py-2 text-xs">{getPlanLabel(p.plan_product, p.plan_key)}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs">
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex gap-2">
                                        {p.status !== 'rejected' && (
                                            <button
                                                onClick={() => handleActivateClinic(p.id)}
                                                className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                            >
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRejectClinic(p.id)}
                                            className="px-2 py-1 text-xs rounded border hover:bg-slate-50"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredPending.length === 0 && (
                            <tr>
                                <td className="px-3 py-4 text-xs text-slate-500" colSpan={6}>
                                    No pending clinics.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Clinics Tab
    const ClinicsTab = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Clinics</h2>
                    <select
                        className="border rounded px-2 py-1 text-xs"
                        value={clinicFilter}
                        onChange={e => setClinicFilter(e.target.value)}
                    >
                        <option value="all">All</option>
                        <option value="core">Core only</option>
                        <option value="care">Care only</option>
                        <option value="bundle">Bundle</option>
                    </select>
                </div>
                <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                            <tr>
                                <th className="px-3 py-2">Clinic</th>
                                <th className="px-3 py-2">Modules</th>
                                <th className="px-3 py-2">Plan</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Usage</th>
                                <th className="px-3 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClinics.map(c => (
                                <tr key={c.id} className="border-t">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-sm">{c.name}</div>
                                        <div className="text-xs text-slate-500">{c.email}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs">{getModulesLabel(c.modules || [], c.is_bundle)}</td>
                                    <td className="px-3 py-2 text-xs">{getPlanLabel(c.plan_product, c.plan_key)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs">
                                        {c.staff_count || 0} staff · {c.location_count || 0} loc
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSelectedClinicId(c.id)}
                                                className="px-2 py-1 text-xs rounded border"
                                            >
                                                View
                                            </button>
                                            {c.status === 'active' && (
                                                <button
                                                    onClick={() => handleSuspendClinic(c.id)}
                                                    className="px-2 py-1 text-xs rounded bg-rose-50 text-rose-700 border border-rose-100"
                                                >
                                                    Suspend
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white border rounded-lg p-4">
                <h2 className="font-semibold text-sm mb-2">Clinic Details</h2>
                {!selectedClinic && (
                    <div className="text-xs text-slate-500">Select a clinic from the table.</div>
                )}
                {selectedClinic && (
                    <div className="space-y-3 text-sm">
                        <div>
                            <div className="font-semibold">{selectedClinic.name}</div>
                            <div className="text-xs text-slate-500">{selectedClinic.email}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-slate-500">Plan</div>
                                <div className="font-medium">{getPlanLabel(selectedClinic.plan_product, selectedClinic.plan_key)}</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-slate-500">Staff</div>
                                <div className="font-medium">{selectedClinic.staff_count || 0}</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-slate-500">Locations</div>
                                <div className="font-medium">{selectedClinic.location_count || 0}</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-slate-500">Bundle</div>
                                <div className="font-medium">{selectedClinic.is_bundle ? 'Yes' : 'No'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // Transactions Tab
    const TransactionsTab = () => (
        <div className="space-y-3">
            <h2 className="font-semibold text-sm">Transactions</h2>
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                        <tr>
                            <th className="px-3 py-2">Ref</th>
                            <th className="px-3 py-2">Clinic</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Method</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(t => (
                            <tr key={t.id} className="border-t">
                                <td className="px-3 py-2 text-xs">{t.tx_ref || t.id.slice(0, 8)}</td>
                                <td className="px-3 py-2 text-xs">{t.clinic?.name || 'N/A'}</td>
                                <td className="px-3 py-2 text-xs">KSh {(t.final_amount || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-xs">{t.method || '-'}</td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${t.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                        t.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                        }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {transactions.length === 0 && (
                            <tr>
                                <td className="px-3 py-4 text-xs text-slate-500" colSpan={6}>No transactions yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Subscriptions Tab
    const SubscriptionsTab = () => (
        <div className="space-y-3">
            <h2 className="font-semibold text-sm">Subscriptions</h2>
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500 border-b">
                        <tr>
                            <th className="px-3 py-2">Clinic</th>
                            <th className="px-3 py-2">Plan</th>
                            <th className="px-3 py-2">Modules</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Renewal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.map(s => (
                            <tr key={s.id} className="border-t">
                                <td className="px-3 py-2 text-xs">{s.clinic?.name || 'N/A'}</td>
                                <td className="px-3 py-2 text-xs">{getPlanLabel(s.plan_product, s.plan_key)}</td>
                                <td className="px-3 py-2 text-xs">{getModulesLabel(s.modules || [], s.is_bundle)}</td>
                                <td className="px-3 py-2 text-xs">KSh {(s.final_amount || 0).toLocaleString()}</td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                    {s.next_renewal_at ? new Date(s.next_renewal_at).toLocaleDateString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {subscriptions.length === 0 && (
                            <tr>
                                <td className="px-3 py-4 text-xs text-slate-500" colSpan={6}>No subscriptions yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // Promos Tab
    const PromosTab = () => {
        const [code, setCode] = useState('');
        const [discount, setDiscount] = useState(10);
        const [expiresAt, setExpiresAt] = useState('');

        const handleCreate = () => {
            if (!code) return;
            handleCreatePromo(code.toUpperCase(), discount, expiresAt);
            setCode('');
            setDiscount(10);
            setExpiresAt('');
        };

        return (
            <div className="space-y-4">
                <h2 className="font-semibold text-sm">Promo Codes</h2>
                <div className="bg-white border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                        <input
                            className="border rounded px-2 py-1 flex-1 min-w-[120px]"
                            placeholder="CODE"
                            value={code}
                            onChange={e => setCode(e.target.value.toUpperCase())}
                        />
                        <input
                            className="border rounded px-2 py-1 w-24"
                            type="number"
                            min="0"
                            max="100"
                            value={discount}
                            onChange={e => setDiscount(Number(e.target.value))}
                            placeholder="%"
                        />
                        <input
                            className="border rounded px-2 py-1 w-40"
                            type="date"
                            value={expiresAt}
                            onChange={e => setExpiresAt(e.target.value)}
                        />
                        <button
                            className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                            onClick={handleCreate}
                        >
                            Create
                        </button>
                    </div>

                    <div className="border-t pt-3">
                        <ul className="space-y-2 text-sm">
                            {promos.map(p => (
                                <li key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                                    <div>
                                        <div className="font-medium">{p.code}</div>
                                        <div className="text-xs text-slate-500">
                                            {p.discount_percent}% · Expires {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : '—'}
                                        </div>
                                    </div>
                                    <button
                                        className="px-2 py-1 text-xs rounded border"
                                        onClick={() => handleTogglePromo(p.id)}
                                    >
                                        {p.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </li>
                            ))}
                            {promos.length === 0 && (
                                <li className="text-xs text-slate-500">No promos yet.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    // Audit Tab
    const AuditTab = () => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Audit Log</h2>
                <select
                    className="border rounded px-2 py-1 text-xs"
                    value={auditFilterType}
                    onChange={e => setAuditFilterType(e.target.value)}
                >
                    <option value="all">All types</option>
                    {uniqueAuditTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>
            <div className="bg-white border rounded-lg p-3 max-h-96 overflow-auto text-sm">
                {filteredAudit.map(a => (
                    <div key={a.id} className="border-b last:border-b-0 py-2">
                        <div className="font-medium">{a.type}</div>
                        <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                        <div className="text-xs text-slate-600">
                            {a.actor_name} → {a.target_name || a.target_entity}
                        </div>
                    </div>
                ))}
                {filteredAudit.length === 0 && (
                    <div className="text-xs text-slate-500">No audit entries.</div>
                )}
            </div>
        </div>
    );

    // Site Content Tab
    const SiteContentTab = () => (
        <div className="space-y-4">
            <h2 className="font-semibold text-sm">Marketing Site Content</h2>
            <div className="bg-white border rounded-lg p-4 space-y-4 text-sm">
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Hero Headline</label>
                    <input
                        className="border rounded px-3 py-2 w-full"
                        value={siteContent.heroHeadline || ''}
                        onChange={e => handleUpdateSiteContent('heroHeadline', e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs text-slate-600 mb-1">Bundle Blurb</label>
                    <textarea
                        className="border rounded px-3 py-2 w-full min-h-[80px]"
                        value={siteContent.bundleBlurb || ''}
                        onChange={e => handleUpdateSiteContent('bundleBlurb', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );

    // Settings Tab
    const SettingsTab = () => (
        <div className="space-y-4 text-sm">
            <div className="bg-white border rounded-lg p-4 space-y-2">
                <h2 className="font-semibold text-sm mb-1">Billing Configuration</h2>
                <div className="text-xs text-slate-600">
                    Gateway: Pesapal (M-Pesa + Card) · Trial: 14 days · Bundle discount: {PLAN_CONFIG.bundleDiscountPercent}%
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <h3 className="font-semibold text-xs mb-1">Core Plans</h3>
                        <ul className="text-xs space-y-1">
                            {Object.entries(PLAN_CONFIG.core).map(([key, cfg]) => (
                                <li key={key}>
                                    {cfg.label}: KSh {cfg.price.toLocaleString()} · {cfg.maxStaff} staff · {cfg.maxLocations} locations
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-xs mb-1">Care Plans</h3>
                        <ul className="text-xs space-y-1">
                            {Object.entries(PLAN_CONFIG.care).map(([key, cfg]) => (
                                <li key={key}>
                                    {cfg.label}: KSh {cfg.price.toLocaleString()} · Unlimited staff · {cfg.maxLocations} locations
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );

    // Main content router
    const MainContent = () => {
        if (loading) {
            return <div className="text-center py-8 text-slate-500">Loading...</div>;
        }
        if (error) {
            return (
                <div className="text-center py-8">
                    <div className="text-red-600 mb-2">Error: {error}</div>
                    <button onClick={loadDashboardData} className="text-sm text-blue-600">Retry</button>
                </div>
            );
        }

        switch (activeTab) {
            case 'Dashboard': return <DashboardTab />;
            case 'Pending Onboarding': return <PendingTab />;
            case 'Clinics': return <ClinicsTab />;
            case 'Transactions': return <TransactionsTab />;
            case 'Subscriptions': return <SubscriptionsTab />;
            case 'Promos': return <PromosTab />;
            case 'Audit': return <AuditTab />;
            case 'Site Content': return <SiteContentTab />;
            case 'Settings': return <SettingsTab />;
            default: return <DashboardTab />;
        }
    };

    // Main layout
    return (
        <div className="min-h-screen flex bg-slate-100">
            {/* Sidebar */}
            <aside className="w-60 shrink-0 bg-white border-r flex flex-col">
                <div className="px-4 py-3 border-b">
                    <div className="text-xs font-semibold text-emerald-700">HURE</div>
                    <div className="text-sm font-semibold">SuperAdmin</div>
                    <div className="text-xs text-slate-500">Core + Care</div>
                </div>
                <nav className="flex-1 px-2 py-3 text-sm space-y-1">
                    {[
                        'Dashboard',
                        'Pending Onboarding',
                        'Clinics',
                        'Transactions',
                        'Subscriptions',
                        'Promos',
                        'Audit',
                        'Site Content',
                        'Settings'
                    ].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`w-full text-left px-3 py-2 rounded-md mb-1 ${activeTab === tab
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                : 'text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
                <div className="px-4 py-3 border-t text-xs text-slate-500">
                    <button onClick={() => { api.logout(); setIsAuthenticated(false); }}>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-lg font-semibold">{activeTab}</h1>
                        <div className="text-xs text-slate-500">
                            Connected to backend API
                        </div>
                    </div>
                    <button
                        onClick={loadDashboardData}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        Refresh Data
                    </button>
                </div>
                <MainContent />
            </main>
        </div>
    );
}
