import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, syncAllVendorRatings } from '../services/mockDatabase';
import { UserRole } from '../types';
import { seedDatabase } from '../services/seeder';
import { Shield, Users, Store, Star, Database, RefreshCw, LayoutDashboard, Sparkles } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [stats, setStats] = useState({ totalUsers: 0, totalVendors: 0, totalReviews: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    useEffect(() => {
        if (!user || user.role !== UserRole.ADMIN) {
            navigate('/login');
            return;
        }

        // Determine active tab from URL
        if (location.pathname.includes('/admin/vendors')) {
            setActiveTab('vendors');
        } else if (location.pathname.includes('/admin/users')) {
            setActiveTab('users');
        } else {
            setActiveTab('dashboard');
        }

        const fetchStats = async () => {
            const res = await api.admin.getStats();
            if (res.success && res.data) setStats(res.data);
            setLoading(false);
        };
        fetchStats();
    }, [user, navigate, location]);

    const handleSeed = async () => {
        if (!window.confirm('Add sample data to database?')) return;
        setLoading(true);
        const res = await seedDatabase();
        alert(res.message);

        const statsRes = await api.admin.getStats();
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        setLoading(false);
    };

    const handleSyncRatings = async () => {
        if (!window.confirm('Sync all vendor ratings from existing reviews?')) return;
        setLoading(true);
        const res = await syncAllVendorRatings();
        alert(res.message);
        setLoading(false);
    };

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { id: 'vendors', label: 'Vendors', icon: Store, path: '/admin/vendors' },
        { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
    ];

    if (loading) return <PageLoading message="Loading admin dashboard..." />;

    return (
        <div className="min-h-screen">
            {/* Hero Header */}
            <div className="relative overflow-hidden border-b border-gray-100 dark:border-slate-800">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent-sky/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-7xl mx-auto px-4 pt-12 pb-8 relative z-10">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg">
                                <Shield size={32} />
                            </div>
                            <div>
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-2">
                                    <Sparkles size={14} />
                                    Admin Access
                                </span>
                                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                    Command <span className="text-primary-600">Centre</span>
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, {user?.name}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSyncRatings}
                                leftIcon={<RefreshCw size={18} />}
                                className="!bg-sky-100 dark:!bg-sky-900/30 !text-sky-700 dark:!text-sky-300 hover:!bg-sky-200"
                            >
                                Sync Ratings
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSeed}
                                leftIcon={<Database size={18} />}
                                className="!bg-green-100 dark:!bg-green-900/30 !text-green-700 dark:!text-green-300 hover:!bg-green-200"
                            >
                                Seed Database
                            </Button>
                        </div>
                    </div>

                    {/* Pill-shaped Tab Switcher */}
                    <div className="flex justify-center">
                        <div className="inline-flex p-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                            {tabs.map((tab) => (
                                <Link
                                    key={tab.id}
                                    to={tab.path}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                                            ? 'bg-primary-600 text-white shadow-md'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <tab.icon size={18} />
                                    {tab.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-12">
                {/* Stats Grid with Gradient Blob */}
                <div className="relative mb-12">
                    {/* Background Gradient Blob */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary-500/5 rounded-full blur-3xl" />
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 relative z-10">
                        {[
                            { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'sky' },
                            { label: 'Active Vendors', value: stats.totalVendors, icon: Store, color: 'primary' },
                            { label: 'Total Reviews', value: stats.totalReviews, icon: Star, color: 'yellow' },
                        ].map((stat, idx) => (
                            <Card key={idx} variant="default" className="relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none group-hover:bg-primary-500/10 transition-all" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                            {stat.label}
                                        </div>
                                        <div className="text-4xl font-extrabold text-gray-900 dark:text-white mt-1">
                                            {stat.value}
                                        </div>
                                    </div>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.color === 'sky' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600' :
                                            stat.color === 'primary' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' :
                                                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                                        }`}>
                                        <stat.icon size={24} />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <Link to="/admin/vendors">
                        <Card variant="default" className="group cursor-pointer">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary-500/10 transition-all" />
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-orange-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <Store size={28} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
                                        Manage Vendors
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        Add, edit, or remove food vendors and their menus.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </Link>

                    <Link to="/admin/users">
                        <Card variant="default" className="group cursor-pointer">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-sky/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-accent-sky/10 transition-all" />
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                    <Users size={28} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors">
                                        Manage Users
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        View users, roles, loyalty points, and account status.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
