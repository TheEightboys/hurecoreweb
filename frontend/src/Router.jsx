import React, { useState, useEffect } from 'react';
import SuperAdminApp from './App';
import FirstLogin from './FirstLogin';
import Onboarding from './Onboarding';
import EmployerDashboard from './EmployerDashboard';
import EmployeeDashboard from './EmployeeDashboard';
import AcceptInvite from './AcceptInvite';
import StaffLogin from './StaffLogin';
import Homepage from './Homepage';

/**
 * Simple Router for HURE Frontend
 * Handles routing between pages
 * 
 * Routes:
 * - / : Homepage (landing page)
 * - /admin : SuperAdmin dashboard
 * - /onboard : Clinic onboarding flow
 * - /first-login : First-time password setup
 * - /login : Returning user login
 * - /employer : Employer dashboard
 * - /employee : Employee dashboard
 * - /employee/login : Staff login
 * - /employee/accept-invite : Staff invite acceptance
 */
export default function Router() {
    const [route, setRoute] = useState('loading');

    useEffect(() => {
        // Simple path-based routing
        const handleRoute = () => {
            const path = window.location.pathname;
            const hash = window.location.hash;

            if (path === '/admin' || hash === '#/admin') {
                setRoute('admin');
            } else if (path === '/onboard' || path.startsWith('/onboard') || hash === '#/onboard') {
                setRoute('onboard');
            } else if (path === '/first-login' || hash === '#/first-login') {
                setRoute('first-login');
            } else if (path === '/login' || hash === '#/login') {
                setRoute('login');
            } else if (path === '/employer' || path.startsWith('/employer') || hash === '#/employer') {
                setRoute('employer');
            } else if (path === '/employee/accept-invite' || hash === '#/employee/accept-invite') {
                setRoute('accept-invite');
            } else if (path === '/employee/login' || hash === '#/employee/login') {
                setRoute('staff-login');
            } else if (path === '/employee' || path.startsWith('/employee') || hash === '#/employee') {
                setRoute('employee');
            } else if (path === '/' || path === '') {
                setRoute('homepage');
            } else {
                setRoute('homepage');
            }
        };

        handleRoute();
        window.addEventListener('hashchange', handleRoute);
        window.addEventListener('popstate', handleRoute);

        return () => {
            window.removeEventListener('hashchange', handleRoute);
            window.removeEventListener('popstate', handleRoute);
        };
    }, []);

    if (route === 'loading') {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (route === 'onboard') {
        return <Onboarding />;
    }

    if (route === 'first-login') {
        return <FirstLogin />;
    }

    if (route === 'login') {
        return <LoginPage />;
    }

    if (route === 'employer') {
        return <EmployerDashboard />;
    }

    if (route === 'accept-invite') {
        return <AcceptInvite />;
    }

    if (route === 'staff-login') {
        return <StaffLogin />;
    }

    if (route === 'employee') {
        return <EmployeeDashboard />;
    }

    if (route === 'admin') {
        return <SuperAdminApp />;
    }

    if (route === 'homepage') {
        return <Homepage />;
    }

    // Default: Homepage
    return <Homepage />;
}

/**
 * Simple Login Page for returning users
 */
function LoginPage() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('hure_auth_token', data.token);
                localStorage.setItem('hure_user', JSON.stringify(data.user));

                // Store clinic ID for employer portal
                if (data.user.clinicId) {
                    localStorage.setItem('hure_clinic_id', data.user.clinicId);
                }

                // Redirect based on role
                if (data.user.role === 'superadmin') {
                    window.location.href = '/';
                } else {
                    window.location.href = '/employer';
                }
            } else {
                if (data.needsFirstLogin) {
                    setError('Please complete your account setup first. Check your email for the activation link.');
                } else {
                    setError(data.error || 'Login failed');
                }
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <div className="text-emerald-700 font-bold text-xl mb-1">HURE</div>
                    <h1 className="text-xl font-bold text-slate-800">Welcome Back</h1>
                    <p className="text-slate-500 text-sm">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Username or Email
                        </label>
                        <input
                            type="text"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Enter username or email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Enter your password"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    <a href="/" className="text-emerald-600 hover:underline">Back to Home</a>
                </div>
            </div>
        </div>
    );
}
