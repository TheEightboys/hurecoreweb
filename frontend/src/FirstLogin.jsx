import React, { useState, useEffect } from 'react';

/**
 * First Login Page
 * User sets their username and permanent password after activation
 */
export default function FirstLogin() {
    const [token, setToken] = useState('');
    const [step, setStep] = useState('loading'); // loading, form, success, error
    const [clinicName, setClinicName] = useState('');
    const [email, setEmail] = useState('');

    // Form state
    const [tempPassword, setTempPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Extract token from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');

        if (!urlToken) {
            setStep('error');
            setError('No activation token found. Please use the link from your activation email.');
            return;
        }

        setToken(urlToken);
        verifyToken(urlToken);
    }, []);

    // Verify the token is valid
    const verifyToken = async (tokenValue) => {
        try {
            const response = await fetch(`/api/auth/verify-token?token=${tokenValue}`);
            const data = await response.json();

            if (data.valid) {
                setClinicName(data.clinicName || '');
                setEmail(data.email || '');
                setStep('form');
            } else if (data.alreadySetup) {
                setStep('error');
                setError('This account has already been set up. Please use the login page.');
            } else {
                setStep('error');
                setError(data.error || 'Invalid or expired activation link.');
            }
        } catch (err) {
            setStep('error');
            setError('Unable to verify activation link. Please try again.');
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!tempPassword || !newPassword || !confirmPassword || !username) {
            setError('All fields are required');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/first-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    tempPassword,
                    newPassword,
                    username
                })
            });

            const data = await response.json();

            if (data.success) {
                // Store the token for auto-login
                if (data.token) {
                    localStorage.setItem('hure_auth_token', data.token);
                    localStorage.setItem('hure_user', JSON.stringify(data.user));
                }
                setStep('success');
            } else {
                setError(data.error || 'Setup failed. Please try again.');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Verifying your activation link...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Activation Error</h1>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <a href="/" className="text-emerald-600 hover:underline">Go to Home</a>
                </div>
            </div>
        );
    }

    // Success state
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 mb-2">Account Setup Complete!</h1>
                    <p className="text-slate-600 mb-6">
                        Your account for <strong>{clinicName}</strong> is ready. You can now log in with your username.
                    </p>
                    <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                        <div className="text-xs text-slate-500 mb-1">Your username</div>
                        <div className="font-mono font-semibold text-lg">{username}</div>
                    </div>
                    <a
                        href="/login"
                        className="inline-block w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                    >
                        Go to Login
                    </a>
                </div>
            </div>
        );
    }

    // Form state
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-emerald-700 font-bold text-xl mb-1">HURE</div>
                    <h1 className="text-xl font-bold text-slate-800">Complete Your Account Setup</h1>
                    {clinicName && (
                        <p className="text-slate-500 text-sm mt-1">for {clinicName}</p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                        />
                    </div>

                    {/* Temporary Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Temporary Password
                            <span className="text-slate-400 font-normal ml-1">(from signup)</span>
                        </label>
                        <input
                            type={showPasswords ? 'text' : 'password'}
                            value={tempPassword}
                            onChange={e => setTempPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Enter your temporary password"
                        />
                    </div>

                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Choose a Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="e.g. johndoe123"
                        />
                        <p className="text-xs text-slate-400 mt-1">Letters, numbers, and underscores only</p>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                        <input
                            type={showPasswords ? 'text' : 'password'}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Minimum 8 characters"
                        />
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                        <input
                            type={showPasswords ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Re-enter your new password"
                        />
                    </div>

                    {/* Show passwords toggle */}
                    <label className="flex items-center text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={showPasswords}
                            onChange={e => setShowPasswords(e.target.checked)}
                            className="mr-2"
                        />
                        Show passwords
                    </label>

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Setting up...' : 'Complete Setup'}
                    </button>
                </form>
            </div>
        </div>
    );
}
