import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, syncAllVendorRatings } from '../services/mockDatabase';
import { UserRole } from '../types';
import { seedDatabase } from '../services/seeder';
import { Shield, Users, Store, Star, Database, RefreshCw, LayoutDashboard } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';
import ConfirmationModal from '../components/ui/ConfirmationModal';

// Import the sub-components (Assuming you can refactor AdminVendors/AdminUsers to be exported components, 
// or we lazily render them here. For now, I will build the TAB SHELL).
// Ideally, you should update AdminVendors.tsx to export a component we can use here, 
// or simply iframe/mount them. A better approach for a "Single View" is to have them as components.
import AdminVendors from './AdminVendors'; // You might need to adjust imports
import AdminUsers from './AdminUsers';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalUsers: 0, totalVendors: 0, totalReviews: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'users'>('overview');
    const [showSeedModal, setShowSeedModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [seedResult, setSeedResult] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        if (!user || user.role !== UserRole.ADMIN) {
            navigate('/login');
            return;
        }
        const fetchStats = async () => {
            const res = await api.admin.getStats();
            if (res.success && res.data) setStats(res.data);
            setLoading(false);
        };
        fetchStats();
    }, [user, navigate]);

    const handleSeed = async () => {
        setActionLoading(true);
        const res = await seedDatabase();
        const statsRes = await api.admin.getStats();
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        setActionLoading(false);
        // @ts-ignore
        setSeedResult(res.message || 'Database seeded successfully!');
    };

    const handleSyncRatings = async () => {
        setActionLoading(true);
        const res = await syncAllVendorRatings();
        setActionLoading(false);
        // @ts-ignore
        setSyncResult(res.message || 'Ratings synced successfully!');
    };

    const closeSeedModal = () => {
        setShowSeedModal(false);
        setSeedResult(null);
    };

    const closeSyncModal = () => {
        setShowSyncModal(false);
        setSyncResult(null);
    };

    if (loading) return <PageLoading message="Initializing Command Centre..." />;

    return (
        <div className="relative min-h-screen bg-gray-50 dark:bg-dark-900 overflow-hidden transition-colors duration-300">
            {/* Glass Blob Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">

                {/* Header & Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-primary-600 to-orange-600 p-3 rounded-2xl shadow-lg shadow-primary-500/20 text-white">
                            <Shield size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight">Command Centre</h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">System Overview & Controls</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setShowSyncModal(true)} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-sm font-medium text-sm">
                            <RefreshCw size={16} /> Sync
                        </button>
                        <button onClick={() => setShowSeedModal(true)} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-sm font-medium text-sm">
                            <Database size={16} /> Seed
                        </button>
                    </div>
                </div>

                {/* Tab Switcher (Pill Shape) */}
                <div className="flex justify-center mb-10">
                    <div className="bg-white dark:bg-slate-900 p-1.5 rounded-full border border-gray-200 dark:border-slate-800 shadow-sm inline-flex">
                        {[
                            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                            { id: 'vendors', label: 'Vendors', icon: Store },
                            { id: 'users', label: 'Users', icon: Users },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-primary-600 text-white shadow-md'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="animate-fade-in">
                    {activeTab === 'overview' && (
                        <>
                            {/* Stats Cards */}
                            <div className="grid md:grid-cols-3 gap-6 mb-8">
                                <StatsCard
                                    label="Total Users"
                                    value={stats.totalUsers}
                                    icon={Users}
                                    color="blue"
                                />
                                <StatsCard
                                    label="Active Vendors"
                                    value={stats.totalVendors}
                                    icon={Store}
                                    color="orange"
                                />
                                <StatsCard
                                    label="Total Reviews"
                                    value={stats.totalReviews}
                                    icon={Star}
                                    color="yellow"
                                />
                            </div>

                            <div className="bg-gradient-to-br from-primary-900 to-slate-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="relative z-10 max-w-2xl">
                                    <h2 className="text-2xl font-bold mb-4">Welcome back, Admin</h2>
                                    <p className="text-primary-100 leading-relaxed mb-6">
                                        You are in full control. Use the tabs above to manage the platform's ecosystem.
                                        Ensure menu accuracy and monitor user activity to keep the campus hungry and happy.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* MOUNTING SUB-PAGES DIRECTLY */}
                    {activeTab === 'vendors' && (
                        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                            <AdminVendors />
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                            <AdminUsers />
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={showSeedModal}
                onClose={closeSeedModal}
                onConfirm={handleSeed}
                title="Seed Database"
                message="Add sample data to the database? This will create new vendors, users, and reviews."
                confirmText="Seed Data"
                cancelText="Cancel"
                variant="warning"
                isLoading={actionLoading}
                resultMessage={seedResult || undefined}
            />
            <ConfirmationModal
                isOpen={showSyncModal}
                onClose={closeSyncModal}
                onConfirm={handleSyncRatings}
                title="Sync Ratings"
                message="Recalculate and sync all vendor ratings and statistics?"
                confirmText="Sync Now"
                cancelText="Cancel"
                variant="default"
                isLoading={actionLoading}
                resultMessage={syncResult || undefined}
            />
        </div>
    );
};

// Reusable Stats Card Component
const StatsCard = ({ label, value, icon: Icon, color }: any) => {
    const colorClasses: any = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
        yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    };

    return (
        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white group-hover:scale-105 transition-transform origin-left">{value}</div>
            </div>
            <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
                <Icon size={24} />
            </div>
        </div>
    );
};

export default AdminDashboard;
