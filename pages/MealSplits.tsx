import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { MealSplit, Vendor } from '../types';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, PlusCircle, X, Search, MapPin, CheckSquare, Share2,
  Filter, Calendar, Store, Utensils, Sparkles, Ticket
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLoading } from '../components/ui/LoadingSpinner';
import { usePushNotifications } from '../hooks/usePushNotifications';

// ============================================
// PROGRESS RING COMPONENT
// ============================================
interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 48,
  strokeWidth = 4
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg className="progress-ring" width={size} height={size}>
      {/* Background circle */}
      <circle
        stroke="currentColor"
        className="text-gray-200 dark:text-gray-700"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      {/* Progress circle */}
      <circle
        stroke="url(#progressGradient)"
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        className="progress-ring__circle"
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ============================================
// SLOT DOTS COMPONENT
// ============================================
interface SlotDotsProps {
  filled: number;
  total: number;
}

const SlotDots: React.FC<SlotDotsProps> = ({ filled, total }) => {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`slot - dot ${i < filled ? 'filled' : 'empty'} `}
          style={{ animationDelay: `${i * 0.1} s` }}
        />
      ))}
    </div>
  );
};

// ============================================
// CREATE SPLIT MODAL
// ============================================
interface CreateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dish: string, vendorId: string, vendorName: string, price: number, people: number, timeNote: string, splitTime: string) => void;
  vendors: Vendor[];
}

const CreateSplitModal: React.FC<CreateSplitModalProps> = ({ isOpen, onClose, onSubmit, vendors }) => {
  const [dish, setDish] = useState('');
  const [menuItems, setMenuItems] = useState<{ name: string, price: number }[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [price, setPrice] = useState('');
  const [people, setPeople] = useState('4');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDishDropdown, setShowDishDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const handleSelectVendor = async (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorSearch(vendor.name);
    setShowDropdown(false);
    const res = await api.vendors.getMenuItems(vendor.id);
    if (res.success && res.data) {
      setMenuItems(res.data);
    } else {
      setMenuItems([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dish && selectedVendor && price && people && date && time) {
      const dateTime = new Date(`${date}T${time} `);

      if (dateTime <= new Date()) {
        alert("Please select a future date and time for the split.");
        return;
      }

      const timeNote = dateTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

      onSubmit(dish, selectedVendor.id, selectedVendor.name, parseFloat(price), parseInt(people), timeNote, dateTime.toISOString());

      setDish('');
      setVendorSearch('');
      setSelectedVendor(null);
      setPrice('');
      setPeople('4');
      setDate('');
      setTime('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass dark:glass-dark rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-lg">
                <Utensils size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Meal Split</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Vendor Search */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Shop Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setShowDropdown(true);
                    setSelectedVendor(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search vendor..."
                  className={`w - full pl - 10 pr - 4 py - 3 rounded - xl bg - white / 50 dark: bg - slate - 800 / 50 border ${selectedVendor ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-gray-200 dark:border-gray-600'} text - gray - 900 dark: text - white placeholder - gray - 400 focus: ring - 2 focus: ring - primary - 500 focus: border - transparent outline - none transition - all`}
                  required
                />
              </div>

              {showDropdown && vendorSearch && (
                <div className="absolute z-10 w-full mt-2 glass dark:glass-dark rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredVendors.length > 0 ? (
                    filteredVendors.map(vendor => (
                      <div
                        key={vendor.id}
                        onClick={() => handleSelectVendor(vendor)}
                        className="px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-gray-900 dark:text-white flex justify-between items-center transition-colors"
                      >
                        <span className="font-medium">{vendor.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <MapPin size={12} />{vendor.location}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">No vendors found</div>
                  )}
                </div>
              )}
            </div>

            {/* Dish Name */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Dish Name
              </label>
              <input
                type="text"
                value={dish}
                onChange={(e) => {
                  setDish(e.target.value);
                  setShowDishDropdown(true);
                }}
                onFocus={() => {
                  if (selectedVendor && menuItems.length > 0) setShowDishDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowDishDropdown(false), 200)}
                placeholder={selectedVendor ? "Search menu or type custom..." : "Select a vendor first"}
                disabled={!selectedVendor}
                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                required
                autoComplete="off"
              />

              {showDishDropdown && selectedVendor && menuItems.length > 0 && dish && (
                <div className="absolute z-10 w-full mt-2 glass dark:glass-dark rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                  {(() => {
                    const matches = menuItems.filter(i => i.name.toLowerCase().includes(dish.toLowerCase()));
                    if (matches.length === 0) return null;
                    return matches.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setDish(item.name);
                          setPrice(item.price.toString());
                          setShowDishDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-gray-900 dark:text-white flex justify-between items-center transition-colors"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="font-bold text-primary-600 text-sm">₹{item.price}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Price & People Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Total Price (₹)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="300"
                  min="1"
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Total People
                </label>
                <select
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                  required
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toLocaleDateString('en-CA')}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!selectedVendor || !dish || !price || !date || !time}
              size="lg"
              className="w-full mt-2"
              leftIcon={<Ticket size={20} />}
            >
              Create Split
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MEAL SPLIT CARD (TICKET STYLE)
// ============================================
interface MealSplitCardProps {
  split: MealSplit;
  vendor?: Vendor;
  user: any;
  isRequested: boolean;
  onJoin: (id: string) => void;
  onCancelRequest: (id: string) => void;
  onLeave: (split: MealSplit) => void;
  onComplete: (split: MealSplit) => void;
  onDelete: (split: MealSplit) => void;
}

const MealSplitCard: React.FC<MealSplitCardProps> = ({
  split,
  vendor,
  user,
  isRequested,
  onJoin,
  onCancelRequest,
  onLeave,
  onComplete,
  onDelete,
}) => {
  const isFull = split.people_joined_ids.length >= split.people_needed;
  const isClosed = split.is_closed;
  const joined = user && split.people_joined_ids.includes(user.id);
  const progress = (split.people_joined_ids.length / split.people_needed) * 100;
  const spotsLeft = split.people_needed - split.people_joined_ids.length;

  return (
    <div className="stagger-item">
      <Card variant="default" className="group relative">
        {/* Top Section */}
        <div className="relative pb-4">

          <div className="flex items-start gap-4">
            {/* Vendor Logo / Avatar */}
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 flex items-center justify-center shadow-inner flex-shrink-0">
              {vendor?.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {split.vendor_name[0]}
                </span>
              )}
            </div>

            {/* Title & Meta */}
            <div className="flex-1 min-w-0 pr-8">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate group-hover:text-primary-600 transition-colors">
                {split.dish_name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-md">
                  <Store size={10} />
                  {split.vendor_name}
                </span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                #{split.id.slice(-6).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Perforated Divider - Already in CSS */}

        {/* Bottom Section */}
        <div className="pt-4 relative">
          {/* Stats Row */}
          <div className="flex items-center justify-between mb-4">
            {/* Price Per Person */}
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">
                Per Person
              </div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                ₹{Math.round(split.total_price / split.people_needed)}
              </div>
            </div>

            {/* Progress Ring */}
            <div className="relative">
              <ProgressRing progress={progress} size={56} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {split.people_joined_ids.length}/{split.people_needed}
                </span>
              </div>
            </div>

            {/* Time & Location */}
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 justify-end">
                <Clock size={14} className="text-primary-500" />
                {split.time_note}
              </div>
              {vendor && (
                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 justify-end mt-1">
                  <MapPin size={10} />
                  {vendor.location}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Creator/Admin Controls */}
            <div className="flex gap-2">
              {user && (split.creator_id === user.id || user.role === 'admin') && (
                <>
                  {!isClosed && split.creator_id === user.id && (
                    <button
                      onClick={() => onComplete(split)}
                      className="p-2 text-accent-success hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      title="Mark as Complete"
                    >
                      <CheckSquare size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(split)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete Split"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Join/Leave/Request Buttons */}
            <div>
              {joined ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLeave(split)}
                  className="!border-red-300 !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                >
                  Leave
                </Button>
              ) : !isClosed ? (
                isRequested ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancelRequest(split.id)}
                    className="!text-red-600"
                  >
                    Withdraw
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onJoin(split.id)}
                    disabled={isFull}
                    rightIcon={<Ticket size={16} />}
                  >
                    {isFull ? 'Full' : 'Join Split'}
                  </Button>
                )
              ) : (
                <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg text-sm font-medium">
                  Completed
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const MealSplits: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { permissionStatus, requestPermission } = usePushNotifications();
  const navigate = useNavigate();
  const [splits, setSplits] = useState<MealSplit[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [myRequests, setMyRequests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter states
  const [filterVendor, setFilterVendor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'price' | 'slots'>('time');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [splitsRes, vendorsRes] = await Promise.all([
      api.splits.getAll(user?.id),
      api.vendors.getAll()
    ]);

    if (splitsRes.success && splitsRes.data) {
      const now = new Date();
      const validSplits: MealSplit[] = [];

      for (const split of splitsRes.data) {
        if (split.split_time && new Date(split.split_time) < now) {
          api.splits.delete(split.id);
        } else {
          validSplits.push(split);
        }
      }
      setSplits(validSplits);
    }
    if (vendorsRes.success && vendorsRes.data) {
      setVendors(vendorsRes.data);
    }

    if (user) {
      // @ts-ignore
      const reqRes = await api.splits.getMyRequests(user.id);
      if (reqRes.success && reqRes.data) {
        setMyRequests(reqRes.data.map((r: any) => r.split_id));
      }
    }
    setLoading(false);
  };

  // Filter & Sort Logic
  const filteredSplits = splits
    .filter(split => {
      if (split.is_closed) return false;

      const isFull = split.people_joined_ids.length >= split.people_needed;
      const joined = user && split.people_joined_ids.includes(user.id);
      if (isFull && !joined && split.creator_id !== user?.id) return false;

      if (filterVendor && !split.vendor_name.toLowerCase().includes(filterVendor.toLowerCase())) {
        return false;
      }

      if (filterDate) {
        const splitDate = new Date(split.split_time || '').toLocaleDateString('en-CA');
        if (splitDate !== filterDate) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (a.total_price / a.people_needed) - (b.total_price / b.people_needed);
        case 'slots':
          return (b.people_needed - b.people_joined_ids.length) - (a.people_needed - a.people_joined_ids.length);
        case 'time':
        default:
          return new Date(a.split_time || 0).getTime() - new Date(b.split_time || 0).getTime();
      }
    });

  const handleRequestJoin = async (id: string) => {
    if (!user) {
      alert("Please sign in to join a split.");
      navigate('/login');
      return;
    }
    const res = await api.splits.requestJoin(id, user.id);
    if (res.success) {
      setMsg(res.message);
      fetchData();
      setTimeout(() => setMsg(''), 3000);
    } else {
      alert(res.message);
    }
  };

  const handleCancelRequest = async (splitId: string) => {
    const reqRes = await api.splits.getMyRequests(user!.id);
    const req = reqRes.data?.find(r => r.split_id === splitId);
    if (req) {
      const res = await api.splits.cancelRequest(req.id);
      if (res.success) {
        setMsg("Request cancelled");
        fetchData();
      }
    }
  };

  const handleLeave = async (split: MealSplit) => {
    if (!user) return;

    const confirmMsg = (split.creator_id === user.id && split.people_joined_ids.length > 1)
      ? 'Leaving will transfer ownership to the next member. Continue?'
      : 'Are you sure you want to leave this split?';

    if (confirm(confirmMsg)) {
      const res = await api.splits.leave(split.id, user.id);
      if (res.success) {
        setMsg(res.message);
        updateUser({ ...user, active_split_id: null });
        fetchData();
        setTimeout(() => setMsg(''), 3000);
      } else {
        alert(res.message);
      }
    }
  };

  const handleComplete = async (split: MealSplit) => {
    if (confirm('Mark this split as complete? This will close it.')) {
      // @ts-ignore
      const res = await api.splits.markAsComplete(split.id);
      if (res.success) {
        setMsg(res.message);
        fetchData();
      } else {
        alert(res.message);
      }
    }
  };

  const handleDelete = async (split: MealSplit) => {
    if (confirm('Are you sure you want to delete this split?')) {
      const res = await api.splits.delete(split.id);
      if (res.success) {
        setMsg(res.message);
        fetchData();
      } else {
        alert(res.message);
      }
    }
  };

  const handleCreate = (dish: string, vendorId: string, vendorName: string, price: number, people: number, timeNote: string, splitTime: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    api.splits.create({
      creator_id: user.id,
      creator_name: user.name,
      vendor_id: vendorId,
      vendor_name: vendorName,
      dish_name: dish,
      total_price: price,
      people_needed: people,
      time_note: timeNote,
      split_time: splitTime,
    }).then(res => {
      if (res.success && res.data) {
        updateUser({ ...user, active_split_id: res.data.id });
        fetchData();
        setIsModalOpen(false);
      } else {
        alert(res.message);
      }
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Food Hunt - Meal Splits',
          text: 'Check out these meal splits on Food Hunt!',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setMsg('Link copied to clipboard!');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  if (loading) return <PageLoading message="Loading meal splits..." />;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="hero-pattern relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 relative z-10">
          {/* Notification Banner */}
          {permissionStatus !== 'granted' && (
            <div className="mb-8 glass dark:glass-dark rounded-2xl p-4 flex items-center justify-between animate-slide-up shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-sky/20 flex items-center justify-center text-accent-sky">
                  <Sparkles size={20} />
                </div>
                <p className="font-medium text-sm text-gray-700 dark:text-gray-200">
                  Enable notifications for instant meal split updates!
                </p>
              </div>
              <Button variant="solid" size="sm" onClick={requestPermission}>
                Enable
              </Button>
            </div>
          )}

          {/* Hero Content */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-4 max-w-2xl animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium">
                <Ticket size={14} />
                Split & Save Together
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
                Meal <span className="text-primary-600">Splits</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                Join forces with fellow foodies. Split the cost, share the joy, and enjoy premium meals for a fraction of the price.
              </p>
            </div>

            <div className="flex gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <button
                onClick={handleShare}
                className="w-12 h-12 rounded-2xl glass dark:glass-dark flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-105 shadow-lg"
                title="Share page"
              >
                <Share2 size={20} />
              </button>
              <Button
                size="lg"
                onClick={() => {
                  if (!user) navigate('/login');
                  else setIsModalOpen(true);
                }}
                leftIcon={<PlusCircle size={22} />}
                className="shadow-glow-primary"
              >
                Start a Split
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent-sky/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 -mt-4 relative z-20 pb-16">
        {/* Filter Bar */}
        <div className="filter-bar glass dark:glass-dark rounded-2xl p-4 mb-8 shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Filter size={18} />
              <span className="text-sm font-medium">Filters</span>
            </div>

            <div className="flex-1 flex flex-wrap items-center gap-3">
              {/* Vendor Filter */}
              <div className="relative min-w-[160px]">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Vendor..."
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Date Filter */}
              <div className="relative min-w-[140px]">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'time' | 'price' | 'slots')}
                className="px-4 py-2 text-sm rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="time">Sort: Time</option>
                <option value="price">Sort: Price</option>
                <option value="slots">Sort: Spots Left</option>
              </select>
            </div>

            {(filterVendor || filterDate) && (
              <button
                onClick={() => { setFilterVendor(''); setFilterDate(''); }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Success Message */}
        {msg && (
          <div className="mb-6 p-4 glass rounded-2xl flex items-center gap-3 animate-slide-up shadow-lg border-l-4 border-accent-success">
            <div className="w-8 h-8 rounded-full bg-accent-success/20 flex items-center justify-center text-accent-success">
              <Sparkles size={16} />
            </div>
            <span className="font-medium text-gray-700 dark:text-gray-200">{msg}</span>
          </div>
        )}

        {/* Splits Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSplits.map(split => (
            <MealSplitCard
              key={split.id}
              split={split}
              vendor={vendors.find(v => v.id === split.vendor_id)}
              user={user}
              isRequested={myRequests.includes(split.id)}
              onJoin={handleRequestJoin}
              onCancelRequest={handleCancelRequest}
              onLeave={handleLeave}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))}

          {filteredSplits.length === 0 && (
            <div className="col-span-full">
              <Card variant="glass" className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6 text-gray-300 dark:text-gray-600">
                  <Users size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Active Splits</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                  Be the first to start a delicious group meal adventure!
                </p>
                <Button
                  onClick={() => {
                    if (!user) navigate('/login');
                    else setIsModalOpen(true);
                  }}
                  leftIcon={<PlusCircle size={20} />}
                >
                  Create a Split
                </Button>
              </Card>
            </div>
          )}
        </div>

        {/* How It Works Section */}
        <div className="mt-16">
          <Card variant="glass" padding="lg" hover={false} className="overflow-hidden">
            <div className="relative z-10">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                  <Sparkles size={14} />
                  Getting Started
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  How It Works
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { num: 1, title: 'Find a Split', desc: 'Browse available meal splits or create your own for a dish you want.' },
                  { num: 2, title: 'Join & Connect', desc: 'Click "Join Split" to connect with others interested in the same meal.' },
                  { num: 3, title: 'Share & Save', desc: 'Split the cost, enjoy great food, and save money while making friends!' },
                ].map((step, i) => (
                  <div key={step.num} className="text-center group">
                    <div
                      className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-xl mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-glow-primary transition-all duration-300"
                      style={{ animationDelay: `${i * 0.1} s` }}
                    >
                      {step.num}
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{step.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-sky/5 rounded-full blur-3xl -ml-24 -mb-24" />
          </Card>
        </div>
      </div>

      {/* Create Split Modal */}
      {isModalOpen && (
        <CreateSplitModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreate}
          vendors={vendors}
        />
      )}
    </div>
  );
};

export default MealSplits;
