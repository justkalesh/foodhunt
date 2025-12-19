
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { UserRole, Vendor, MenuItem } from '../types';
import { Trash2, Edit, Plus, ChevronLeft, X, AlertTriangle, Utensils, Star, Camera, Loader2 } from 'lucide-react';

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

  if (loading) return <div className="p-10 text-center dark:text-white">Loading Vendors...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin" className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 mb-4 text-sm font-medium">
            <ChevronLeft size={16} /> Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold dark:text-white">Manage Vendors</h1>
            <button
              onClick={openAddModal}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-sm"
            >
              <Plus size={20} /> Add Vendor
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 shadow-md rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pricing ($)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-dark-800 divide-y divide-gray-200 dark:divide-gray-700">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <img className="h-10 w-10 rounded-full object-cover" src={vendor.logo_url || vendor.menu_image_urls?.[0]} alt="" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                            {vendor.name}
                            {vendor.is_featured && <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">⭐</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.location}</div>
                          <div className="text-xs text-gray-400">Order: {vendor.sort_order}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{vendor.cuisine}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.origin_tag}</div>
                      <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">{vendor.contact_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      Low: {vendor.lowest_item_price} / Avg: {vendor.avg_price_per_meal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(vendor)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${vendor.is_active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} transition-colors cursor-pointer`}
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
                        <div key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              {item.name}
                              {item.category && <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">{item.category}</span>}
                              {item.is_recommended && <Star size={14} className="fill-yellow-400 text-yellow-400" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => handleToggleRecommended(item)}
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
                              onClick={() => handleDeleteMenuItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
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
