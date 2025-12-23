/**
 * HURE Core - API Client
 * Handles all API calls to the backend
 */

// Vite uses import.meta.env, not process.env
const API_BASE = import.meta.env.VITE_API_URL || '';

// Get stored auth token
function getToken() {
    return localStorage.getItem('hure_superadmin_token');
}

// Set auth token
function setToken(token) {
    localStorage.setItem('hure_superadmin_token', token);
}

// Clear auth
function clearAuth() {
    localStorage.removeItem('hure_superadmin_token');
}

// Base fetch wrapper with auth
async function apiFetch(endpoint, options = {}) {
    const token = getToken();

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (response.status === 401) {
        clearAuth();
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API Error');
    }

    return data;
}

// ============================================
// CLINIC APIs
// ============================================

export async function getClinics(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/clinics${query ? `?${query}` : ''}`);
}

export async function getClinic(id) {
    return apiFetch(`/api/clinics/${id}`);
}

export async function activateClinic(id) {
    return apiFetch(`/api/clinics/${id}/activate`, { method: 'PATCH' });
}

export async function suspendClinic(id, reason) {
    return apiFetch(`/api/clinics/${id}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    });
}

export async function rejectClinic(id, reason) {
    return apiFetch(`/api/clinics/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    });
}

export async function changeClinicPlan(id, planKey, modules) {
    return apiFetch(`/api/clinics/${id}/change-plan`, {
        method: 'PATCH',
        body: JSON.stringify({ planKey, modules }),
    });
}

export async function getClinicStats() {
    return apiFetch('/api/clinics/stats/overview');
}

// ============================================
// SUBSCRIPTION APIs
// ============================================

export async function getSubscriptions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/subscriptions${query ? `?${query}` : ''}`);
}

export async function toggleAutoRenew(id, enabled) {
    return apiFetch(`/api/subscriptions/${id}/autorenew`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
    });
}

export async function upgradeSubscription(id, planKey, modules) {
    return apiFetch(`/api/subscriptions/${id}/upgrade`, {
        method: 'PATCH',
        body: JSON.stringify({ planKey, modules }),
    });
}

// ============================================
// TRANSACTION APIs
// ============================================

export async function getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/transactions${query ? `?${query}` : ''}`);
}

// ============================================
// PROMO APIs
// ============================================

export async function getPromos() {
    return apiFetch('/api/promos');
}

export async function createPromo(data) {
    return apiFetch('/api/promos', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function togglePromo(id) {
    return apiFetch(`/api/promos/${id}/toggle`, { method: 'PATCH' });
}

// ============================================
// AUDIT APIs
// ============================================

export async function getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/audit${query ? `?${query}` : ''}`);
}

export async function getAuditTypes() {
    return apiFetch('/api/audit/types');
}

export async function getApiLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/audit/api-logs${query ? `?${query}` : ''}`);
}

// ============================================
// SITE CONTENT APIs
// ============================================

export async function getSiteContent() {
    return apiFetch('/api/site-content');
}

export async function updateSiteContent(data) {
    return apiFetch('/api/site-content', {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
}

// ============================================
// AUTH APIs
// ============================================

export async function login(email, password) {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (data.token) {
        setToken(data.token);
    }
    return data;
}

export function logout() {
    clearAuth();
}

export function isAuthenticated() {
    return !!getToken();
}

export { setToken, getToken, clearAuth };
