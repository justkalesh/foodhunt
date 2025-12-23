
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const CompleteProfile: React.FC = () => {
    const navigate = useNavigate();
    const { completeGoogleSignup } = useAuth();
    // User arrives here via OAuth redirect when needsCompletion is true
    // We fetch the current Supabase session to get user info

    const [formData, setFormData] = useState({
        name: '',
        semester: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            // 1. Check Supabase Session
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setFormData(prev => ({
                    ...prev,
                    name: user.user_metadata?.full_name || '',
                }));
            } else {
                // No user found, redirect to login
                navigate('/login');
            }
        };

        checkAuth();

    }, [navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setError('No authenticated user found.');
            return;
        }

        setLoading(true);
        // We reuse completeGoogleSignup interface but pass the Supabase user
        const res = await completeGoogleSignup(formData, user);
        setLoading(false);

        if (res.success) {
            // Navigation handled by App.tsx redirect logic (needsCompletion becoming false)
            // or we can force it
            navigate('/');
        } else {
            setError(res.message);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full bg-white dark:bg-dark-800 p-8 rounded-2xl shadow-lg border dark:border-gray-700">
                <h2 className="text-3xl font-bold mb-2 text-center text-gray-900 dark:text-white">Complete Profile</h2>
                <p className="text-center text-gray-500 mb-6">Please provide a few more details.</p>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                        <input
                            name="name" type="text" required
                            className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            placeholder="Jane Doe"
                            value={formData.name} onChange={handleChange}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                        <select
                            name="semester" required
                            className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            value={formData.semester} onChange={handleChange}
                        >
                            <option value="">Select Semester</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50"
                    >
                        {loading ? 'Save & Continue' : 'Complete Signup'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
