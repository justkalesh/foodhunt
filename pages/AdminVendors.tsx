
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { UserRole, Vendor, MenuItem } from '../types';
import { Trash2, Edit, Plus, ChevronLeft, X, AlertTriangle, Utensils, Star, Camera, Loader2, Shield, Store, Users, LayoutDashboard, Sparkles } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';

const AdminVendors: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVendor, setCurrentVendor] = useState<Partial<Vendor>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Menu Management State
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [selectedVendorForMenu, setSelectedVendorForMenu] = useState<Vendor | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newMenuItemName, setNewMenuItemName] = useState('');
  const [newMenuItemPrice, setNewMenuItemPrice] = useState('');
  const [newMenuItemCategory, setNewMenuItemCategory] = useState('');
  const [addingMenuItem, setAddingMenuItem] = useState(false);

  // Size variant mode for add menu item
  const [hasSizeVariants, setHasSizeVariants] = useState(false);
  const [smallPrice, setSmallPrice] = useState('');
  const [mediumPrice, setMediumPrice] = useState('');
  const [largePrice, setLargePrice] = useState('');

  // Edit Menu Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editHasSizes, setEditHasSizes] = useState(false);
  const [editSmallPrice, setEditSmallPrice] = useState('');
  const [editMediumPrice, setEditMediumPrice] = useState('');
  const [editLargePrice, setEditLargePrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Menu Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && user.role !== UserRole.ADMIN) {
      navigate('/');
      return;
    }
    fetchVendors();
  }, [user, navigate]);

  const fetchVendors = async () => {
    setLoading(true);
    const res = await api.vendors.getAll();
    if (res.success && res.data) {
      setVendors(res.data);
    }
    setLoading(false);
  };

  const openMenuModal = async (vendor: Vendor) => {
    setSelectedVendorForMenu(vendor);
    const res = await api.vendors.getMenuItems(vendor.id);
    if (res.success && res.data) {
      setMenuItems(res.data);
    }
    setIsMenuModalOpen(true);
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorForMenu || !newMenuItemName) return;

    // Validate: either regular price OR at least one size price is required
    if (!hasSizeVariants && !newMenuItemPrice) {
      alert('Please enter a price');
      return;
    }
    if (hasSizeVariants && !smallPrice && !mediumPrice && !largePrice) {
      alert('Please enter at least one size price');
      return;
    }

    setAddingMenuItem(true);
    const res = await api.vendors.addMenuItem(
      selectedVendorForMenu.id,
      newMenuItemName,
      hasSizeVariants ? 0 : parseFloat(newMenuItemPrice),
      newMenuItemCategory || undefined,
      hasSizeVariants ? {
        small_price: smallPrice ? parseFloat(smallPrice) : undefined,
        medium_price: mediumPrice ? parseFloat(mediumPrice) : undefined,
        large_price: largePrice ? parseFloat(largePrice) : undefined,
      } : undefined
    );

    if (res.success && res.data) {
      setMenuItems([...menuItems, res.data]);
      setNewMenuItemName('');
      setNewMenuItemPrice('');
      setNewMenuItemCategory('');
      setSmallPrice('');
      setMediumPrice('');
      setLargePrice('');
      setHasSizeVariants(false);
    } else {
      alert(res.message);
    }
    setAddingMenuItem(false);
  };

  // Handle scanning menu from image
  const handleScanMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVendorForMenu) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setIsScanning(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];

        try {
          const response = await fetch('/api/scan-menu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64String,
              mimeType: file.type
            })
          });

          const data = await response.json();

          if (data.success && data.items) {
            // Add scanned items to the database and update local state
            const addedItems: MenuItem[] = [];
            for (const item of data.items) {
              // Check if this item has size variants
              const hasSmall = item.small_price != null;
              const hasMedium = item.medium_price != null;
              const hasLarge = item.large_price != null;
              const hasSizes = hasSmall || hasMedium || hasLarge;

              const res = await api.vendors.addMenuItem(
                selectedVendorForMenu.id,
                item.name,
                hasSizes ? 0 : (item.price || 0), // Use 0 as base price if sizes exist
                item.category,
                // Only pass size prices if at least one exists
                hasSizes ? {
                  small_price: hasSmall ? item.small_price : undefined,
                  medium_price: hasMedium ? item.medium_price : undefined,
                  large_price: hasLarge ? item.large_price : undefined
                } : undefined
              );
              if (res.success && res.data) {
                addedItems.push(res.data);
              }
            }
            setMenuItems(prev => [...prev, ...addedItems]);
            alert(`Successfully added ${addedItems.length} menu items!`);
          } else {
            console.error('API Response:', data);
            alert(`Error: ${data.error}\nDetails: ${data.details || 'No details available'}`);
          }
        } catch (error) {
          console.error('Scan API error:', error);
          alert(`Failed to process the image.\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        setIsScanning(false);
      };

      reader.onerror = () => {
        alert('Failed to read the image file.');
        setIsScanning(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File processing error:', error);
      alert('Failed to process the image.');
      setIsScanning(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    const res = await api.vendors.deleteMenuItem(itemId);
    if (res.success) {
      setMenuItems(menuItems.filter(item => item.id !== itemId));
    } else {
      alert(res.message);
    }
  };

  const startEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditCategory(item.category || '');
    // Check if item has size variants
    const hasSmall = item.small_price != null;
    const hasMedium = item.medium_price != null;
    const hasLarge = item.large_price != null;
    const hasSizes = hasSmall || hasMedium || hasLarge;

    setEditHasSizes(hasSizes);
    if (hasSizes) {
      setEditPrice('');
      setEditSmallPrice(item.small_price?.toString() || '');
      setEditMediumPrice(item.medium_price?.toString() || '');
      setEditLargePrice(item.large_price?.toString() || '');
    } else {
      setEditPrice(item.price?.toString() || '');
      setEditSmallPrice('');
      setEditMediumPrice('');
      setEditLargePrice('');
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditName('');
    setEditCategory('');
    setEditPrice('');
    setEditHasSizes(false);
    setEditSmallPrice('');
    setEditMediumPrice('');
    setEditLargePrice('');
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !selectedVendorForMenu) return;

    // Validate
    if (!editName.trim()) {
      alert('Item name is required');
      return;
    }
    if (!editHasSizes && !editPrice) {
      alert('Please enter a price');
      return;
    }
    if (editHasSizes && !editSmallPrice && !editMediumPrice && !editLargePrice) {
      alert('Please enter at least one size price');
      return;
    }

    setSavingEdit(true);

    const updatedItem: MenuItem = {
      id: editingItemId,
      vendor_id: selectedVendorForMenu.id,
      name: editName.trim(),
      category: editCategory.trim() || undefined,
      price: editHasSizes ? 0 : parseFloat(editPrice),
      is_active: true,
      small_price: editHasSizes && editSmallPrice ? parseFloat(editSmallPrice) : undefined,
      medium_price: editHasSizes && editMediumPrice ? parseFloat(editMediumPrice) : undefined,
      large_price: editHasSizes && editLargePrice ? parseFloat(editLargePrice) : undefined,
    };

    const res = await api.vendors.updateMenuItem(updatedItem);
    if (res.success && res.data) {
      setMenuItems(menuItems.map(item => item.id === editingItemId ? res.data! : item));
      cancelEdit();
    } else {
      alert(res.message || 'Failed to update item');
    }
    setSavingEdit(false);
  };

  const handleToggleRecommended = async (item: MenuItem) => {
    // Logic inside mock database now handles toggling (if on -> off, if off -> on + clear others)
    const res = await api.vendors.setRecommendedItem(item.vendor_id, item.id);
    if (res.success) {
      setMenuItems(menuItems.map(i => {
        if (i.id === item.id) return { ...i, is_recommended: !i.is_recommended }; // Toggle clicked one
        if (!item.is_recommended) return { ...i, is_recommended: false }; // If we turned it ON, others go OFF
        return i; // If we turned it OFF, others likely stay same (which is false)
      }));
    } else {
      alert(res.message);
    }
  };

  const handleToggleStatus = async (vendor: Vendor) => {
    await api.admin.vendors.update(vendor.id, { is_active: !vendor.is_active });
    fetchVendors();
  };

  // Opens the delete confirmation modal
  const promptDelete = (id: string) => {
    setDeleteId(id);
  };

  // Executes the actual delete
  const executeDelete = async () => {
    if (!deleteId) return;
    await api.admin.vendors.delete(deleteId);
    setDeleteId(null);
    fetchVendors();
  };

  const openAddModal = () => {
    setCurrentVendor({
      name: '', description: '', location: '', cuisine: '',
      origin_tag: 'North', rush_level: 'mid',
      logo_url: 'https://picsum.photos/200',
      menu_image_urls: ['https://picsum.photos/800/600'],
      contact_number: '1234567890',
      popularity_score: 80, is_active: true,
      sort_order: 999, is_featured: false
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setCurrentVendor(vendor);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVendor.name || !currentVendor.location) return alert("Name and Location required");

    if (isEditing && currentVendor.id) {
      await api.admin.vendors.update(currentVendor.id, currentVendor);
    } else {
      await api.admin.vendors.create(currentVendor as Omit<Vendor, 'id' | 'created_at'>);
    }
    setIsModalOpen(false);
    fetchVendors();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Check if it's a checkbox
    const checked = (e.target as HTMLInputElement).checked;

    setCurrentVendor(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  if (loading) return <PageLoading message="Loading vendors..." />;

  return (
    <div className="min-h-screen">
      {/* Hero Header with Tab Navigation */}
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
                  Manage <span className="text-primary-600">Vendors</span>
                </h1>
              </div>
            </div>

            <button
              onClick={openAddModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg hover:shadow-primary-500/30 transition-all hover:-translate-y-0.5"
            >
              <Plus size={20} />
              Add Vendor
            </button>
          </div>

          {/* Pill-shaped Tab Switcher */}
          <div className="flex justify-center">
            <div className="inline-flex p-1.5 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
                { id: 'vendors', label: 'Vendors', icon: Store, path: '/admin/vendors' },
                { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
              ].map((tab) => (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${tab.id === 'vendors'
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

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pricing (₹)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 flex-shrink-0">
                          <img className="h-12 w-12 rounded-xl object-cover border border-gray-100 dark:border-slate-700" src={vendor.logo_url || vendor.menu_image_urls?.[0]} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {vendor.name}
                            {vendor.is_featured && <span className="text-xs bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2 py-0.5 rounded-full font-bold">⭐ Featured</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.location}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">Order: {vendor.sort_order}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{vendor.cuisine}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.origin_tag}</div>
                      <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">{vendor.contact_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-white">₹{vendor.lowest_item_price}</span> - ₹{vendor.avg_price_per_meal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(vendor)}
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full transition-colors cursor-pointer ${vendor.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                          }`}
                      >
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => openEditModal(vendor)} className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 inline-flex items-center gap-1">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => promptDelete(vendor.id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 inline-flex items-center gap-1">
                      </button>
                      <button onClick={() => openMenuModal(vendor)} className="text-secondary-600 hover:text-secondary-900 dark:hover:text-secondary-400 inline-flex items-center gap-1" title="Manage Menu">
                        <Utensils size={16} />
                      </button>
                      <button onClick={() => promptDelete(vendor.id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 inline-flex items-center gap-1">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit/Create Vendor Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-dark-800 z-10">
                <h2 className="text-xl font-bold dark:text-white">{isEditing ? 'Edit Vendor' : 'Add New Vendor'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor Name</label>
                  <input name="name" type="text" required value={currentVendor.name} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
                  <input name="sort_order" type="number" value={currentVendor.sort_order} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="md:col-span-1 flex items-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input name="is_featured" type="checkbox" checked={currentVendor.is_featured || false} onChange={handleChange} className="w-5 h-5 text-primary-600 rounded" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Featured Vendor</span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea name="description" rows={3} value={currentVendor.description} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                  <input name="location" type="text" required value={currentVendor.location} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuisine</label>
                  <input name="cuisine" type="text" required value={currentVendor.cuisine} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origin Tag</label>
                  <select name="origin_tag" value={currentVendor.origin_tag} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white">
                    {['North', 'South', 'West', 'Chinese', 'Indo-Chinese', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rush Level</label>
                  <select name="rush_level" value={currentVendor.rush_level} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white">
                    {['low', 'mid', 'high'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number</label>
                  <input name="contact_number" type="text" value={currentVendor.contact_number || ''} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                  <input name="logo_url" type="text" value={currentVendor.logo_url} onChange={handleChange} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Menu Image URLs</label>
                  <div className="space-y-2">
                    {(currentVendor.menu_image_urls || []).map((url, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...(currentVendor.menu_image_urls || [])];
                            newUrls[index] = e.target.value;
                            setCurrentVendor({ ...currentVendor, menu_image_urls: newUrls });
                          }}
                          placeholder={`Image URL ${index + 1}`}
                          className="flex-1 p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newUrls = [...(currentVendor.menu_image_urls || [])];
                            newUrls.splice(index, 1);
                            setCurrentVendor({ ...currentVendor, menu_image_urls: newUrls });
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Remove Image"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newUrls = [...(currentVendor.menu_image_urls || [])];
                      newUrls.push('');
                      setCurrentVendor({ ...currentVendor, menu_image_urls: newUrls });
                    }}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={16} /> Add Another Image
                  </button>
                </div>
                <div className="md:col-span-2 pt-4 flex gap-4">
                  <button type="submit" className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-bold transition">
                    {isEditing ? 'Save Changes' : 'Create Vendor'}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {
          deleteId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center border dark:border-gray-700">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">Delete Vendor?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Are you sure you want to delete this vendor? This action cannot be undone.
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* Menu Management Modal */}
        {isMenuModalOpen && selectedVendorForMenu && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                <div>
                  <h2 className="text-xl font-bold dark:text-white">Manage Menu</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">for {selectedVendorForMenu.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Scan Menu Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="bg-secondary-600 hover:bg-secondary-700 disabled:bg-secondary-400 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Camera size={18} />
                        Scan Menu Image
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleScanMenu}
                    className="hidden"
                  />
                  <button onClick={() => setIsMenuModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar dark:bg-dark-900">
                {/* Add Item Form */}
                <form onSubmit={handleAddMenuItem} className="flex gap-4 mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Butter Chicken"
                      value={newMenuItemName}
                      onChange={(e) => setNewMenuItemName(e.target.value)}
                      className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Starters"
                      value={newMenuItemCategory}
                      onChange={(e) => setNewMenuItemCategory(e.target.value)}
                      className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                    />
                  </div>

                  {/* Price Section with S/M/L Toggle */}
                  {!hasSizeVariants ? (
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Price (₹)</label>
                        <button
                          type="button"
                          onClick={() => setHasSizeVariants(true)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold"
                          title="Enable S/M/L sizes"
                        >
                          S/M/L
                        </button>
                      </div>
                      <input
                        type="number"
                        placeholder="99"
                        value={newMenuItemPrice}
                        onChange={(e) => setNewMenuItemPrice(e.target.value)}
                        className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="w-20">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-500 uppercase">Small</label>
                          <button
                            type="button"
                            onClick={() => { setHasSizeVariants(false); setSmallPrice(''); setMediumPrice(''); setLargePrice(''); }}
                            className="text-xs text-red-500 hover:text-red-700"
                            title="Switch to single price"
                          >
                            ×
                          </button>
                        </div>
                        <input
                          type="number"
                          placeholder="S"
                          value={smallPrice}
                          onChange={(e) => setSmallPrice(e.target.value)}
                          className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medium</label>
                        <input
                          type="number"
                          placeholder="M"
                          value={mediumPrice}
                          onChange={(e) => setMediumPrice(e.target.value)}
                          className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Large</label>
                        <input
                          type="number"
                          placeholder="L"
                          value={largePrice}
                          onChange={(e) => setLargePrice(e.target.value)}
                          className="w-full p-2 rounded border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={addingMenuItem}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-[38px]"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </form>

                {/* Items List */}
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Current Menu Items ({menuItems.length})</h3>
                  {menuItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      No menu items found. Add one above!
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-dark-900 border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                      {menuItems.map(item => (
                        <div key={item.id}>
                          {editingItemId === item.id ? (
                            /* Editing mode - inline form */
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50">
                              <div className="flex flex-wrap gap-3 mb-3">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Item Name"
                                  className="flex-1 min-w-[150px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                />
                                <input
                                  type="text"
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                  placeholder="Category"
                                  className="w-[120px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                />
                              </div>

                              {/* Price inputs with S/M/L toggle */}
                              <div className="flex flex-wrap gap-3 mb-3 items-center">
                                <button
                                  type="button"
                                  onClick={() => setEditHasSizes(!editHasSizes)}
                                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${editHasSizes
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                  S/M/L
                                </button>

                                {editHasSizes ? (
                                  <>
                                    <input
                                      type="number"
                                      value={editSmallPrice}
                                      onChange={(e) => setEditSmallPrice(e.target.value)}
                                      placeholder="S ₹"
                                      className="w-[70px] px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                    />
                                    <input
                                      type="number"
                                      value={editMediumPrice}
                                      onChange={(e) => setEditMediumPrice(e.target.value)}
                                      placeholder="M ₹"
                                      className="w-[70px] px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                    />
                                    <input
                                      type="number"
                                      value={editLargePrice}
                                      onChange={(e) => setEditLargePrice(e.target.value)}
                                      placeholder="L ₹"
                                      className="w-[70px] px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                    />
                                  </>
                                ) : (
                                  <input
                                    type="number"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    placeholder="Price ₹"
                                    className="w-[100px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-dark-900 text-gray-900 dark:text-white text-sm"
                                  />
                                )}
                              </div>

                              {/* Save/Cancel buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={savingEdit}
                                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                                >
                                  {savingEdit ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-sm font-bold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Display mode - clickable row */
                            <div
                              className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              onClick={() => startEditItem(item)}
                            >
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  {item.name}
                                  {item.category && <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">{item.category}</span>}
                                  {item.is_recommended && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleRecommended(item); }}
                                  className={`p-1 rounded transition-colors ${item.is_recommended ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-400 hover:text-yellow-400'}`}
                                  title={item.is_recommended ? "Recommended Item" : "Mark as Recommended"}
                                >
                                  <Star size={18} className={item.is_recommended ? "fill-yellow-400" : ""} />
                                </button>
                                {/* Price display - show S/M/L if size prices exist */}
                                {(item.small_price != null || item.medium_price != null || item.large_price != null) ? (
                                  <span className="font-bold text-green-600 text-sm">
                                    {item.small_price != null && `S:₹${item.small_price}`}
                                    {item.small_price != null && (item.medium_price != null || item.large_price != null) && ' | '}
                                    {item.medium_price != null && `M:₹${item.medium_price}`}
                                    {item.medium_price != null && item.large_price != null && ' | '}
                                    {item.large_price != null && `L:₹${item.large_price}`}
                                  </span>
                                ) : (
                                  <span className="font-bold text-green-600">₹{item.price}</span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMenuItem(item.id); }}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Delete Item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminVendors;
