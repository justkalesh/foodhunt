
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockDatabase';
import { useAuth } from '../contexts/AuthContext';
import { MenuItem, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const VendorDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<MenuItem[]>([]);

    // In a real app, we would look up the vendor associated with this user
    // For this mock, we assume user 'vendor01' owns 'v1'
    const vendorId = 'v1';

    useEffect(() => {
        if (!user || user.role !== UserRole.VENDOR) {
            navigate('/');
            return;
        }
        api.vendors.getMenuItems(vendorId).then(res => setItems(res.data || []));
    }, [user, navigate]);

    const handleToggle = async (item: MenuItem) => {
        const updated = { ...item, is_active: !item.is_active };
        await api.vendors.updateMenuItem(updated);
        setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold dark:text-white mb-6">Vendor Dashboard</h1>
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {items.map(item => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-300">${item.price}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {item.is_active ? 'Active' : 'Sold Out'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleToggle(item)} className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400">
                                        Toggle Status
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VendorDashboard;