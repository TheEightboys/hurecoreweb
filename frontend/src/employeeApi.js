/**
 * HURE Core - Employee/Staff API Client
 * Handles all employee portal API requests
 */

const API_BASE = '';

function getToken() {
    return localStorage.getItem('hure_staff_token');
}

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function apiFetch(url, options = {}) {
    const response = await fetch(API_BASE + url, {
        ...options,
        headers: { ...getHeaders(), ...options.headers }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

// ===================
// STAFF AUTH
// ===================

export async function verifyInvite(token) {
    return apiFetch(`/api/staff/verify-invite?token=${token}`);
}

export async function acceptInvite(token, password) {
    return apiFetch('/api/staff/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password })
    });
}

export async function staffLogin(email, password) {
    return apiFetch('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

// ===================
// PROFILE
// ===================

export async function getProfile() {
    return apiFetch('/api/employee/profile');
}

export async function updateProfile(data) {
    return apiFetch('/api/employee/profile', {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
}

// ===================
// SCHEDULE
// ===================

export async function getSchedule(from, to) {
    let url = '/api/employee/schedule';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (params.toString()) url += '?' + params.toString();
    return apiFetch(url);
}

export async function respondToShift(shiftId, status, reason = null) {
    return apiFetch(`/api/employee/schedule/${shiftId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason })
    });
}

// ===================
// ATTENDANCE
// ===================

export async function getAttendance(from, to) {
    let url = '/api/employee/attendance';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (params.toString()) url += '?' + params.toString();
    return apiFetch(url);
}

export async function clockIn() {
    return apiFetch('/api/employee/attendance/clock-in', {
        method: 'POST'
    });
}

export async function clockOut() {
    return apiFetch('/api/employee/attendance/clock-out', {
        method: 'POST'
    });
}

// ===================
// LEAVE
// ===================

export async function getLeaveRequests() {
    return apiFetch('/api/employee/leave');
}

export async function submitLeaveRequest(data) {
    return apiFetch('/api/employee/leave', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// ===================
// DOCUMENTS
// ===================

export async function getDocuments() {
    return apiFetch('/api/employee/documents');
}

export async function acknowledgeDocument(docId) {
    return apiFetch(`/api/employee/documents/${docId}/acknowledge`, {
        method: 'POST'
    });
}

export async function downloadDocument(docId) {
    return apiFetch(`/api/employee/documents/${docId}/download`);
}

// ===================
// HELPERS
// ===================

export function setStaffToken(token) {
    localStorage.setItem('hure_staff_token', token);
}

export function clearStaffAuth() {
    localStorage.removeItem('hure_staff_token');
}

export function isStaffAuthenticated() {
    return !!getToken();
}
