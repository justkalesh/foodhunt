import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { MealSplit, Vendor } from '../types';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, PlusCircle, X, Search, MapPin, CheckSquare } from 'lucide-react';

interface CreateSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dish: string, vendorId: string, vendorName: string, price: number, people: number, timeNote: string, splitTime: string) => void;
  vendors: Vendor[];
}

const CreateSplitModal: React.FC<CreateSplitModalProps> = ({ isOpen, onClose, onSubmit, vendors }) => {
  const [dish, setDish] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [price, setPrice] = useState('');
  const [people, setPeople] = useState('4');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dish && selectedVendor && price && people && date && time) {
      const dateTime = new Date(`${date}T${time}`);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all scale-100">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Meal Split</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Dish Name</label>
              <input
                type="text"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
                placeholder="e.g. Family Size Pizza"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shop Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setShowDropdown(true);
                    setSelectedVendor(null); // Reset selection on type
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search vendor..."
                  className={`w-full pl-10 pr-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border ${selectedVendor ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all`}
                  required
                />
              </div>

              {showDropdown && vendorSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                  {filteredVendors.length > 0 ? (
                    filteredVendors.map(vendor => (
                      <div
                        key={vendor.id}
                        onClick={() => {
                          setSelectedVendor(vendor);
                          setVendorSearch(vendor.name);
                          setShowDropdown(false);
                        }}
                        className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-white flex justify-between items-center"
                      >
                        <span className="font-medium">{vendor.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{vendor.location}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">No vendors found</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Total Price (₹)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="300"
                  min="1"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Total People</label>
                <select
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none"
                  required
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toLocaleDateString('en-CA')}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedVendor || !dish || !price || !date || !time}
              className={`w-full py-3.5 rounded-lg font-bold shadow-lg transition-all transform active:scale-[0.98] mt-2 ${(!selectedVendor || !dish || !price || !date || !time)
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-[#ea580c] hover:bg-[#c2410c] text-white'
                }`}
            >
              Post Split
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const MealSplits: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [splits, setSplits] = useState<MealSplit[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      // Check for expired splits and delete them
      for (const split of splitsRes.data) {
        if (split.split_time && new Date(split.split_time) < now) {
          // Auto-delete expired split
          api.splits.delete(split.id);
        } else {
          validSplits.push(split);
        }
      }
      setSplits(validSplits);
    } else {
      console.error("Failed to fetch splits:", splitsRes.message);
      // Optional: alert(splitsRes.message); // Uncomment if you want to see it in UI
    }
    if (vendorsRes.success && vendorsRes.data) {
      setVendors(vendorsRes.data);
    }
    setLoading(false);
  };

  const handleJoin = async (id: string) => {
    if (!user) {
      alert("Please sign in to join a split.");
      navigate('/login');
      return;
    }

    const splitToJoin = splits.find(s => s.id === id);
    if (!splitToJoin) return;

    const res = await api.splits.join(id, user.id);
    if (res.success) {
      // Auto-send message to creator
      await api.messages.send(
        user.id,
        splitToJoin.creator_id,
        `Hii, I'd like to join your split of ${splitToJoin.dish_name} from ${splitToJoin.vendor_name}`
      );

      // Update local user context to reflect active split
      updateUser({ ...user, active_split_id: id });

      setMsg(res.message);
      fetchData();
      setTimeout(() => setMsg(''), 3000);
    } else {
      alert(res.message);
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
        // Update local user context to reflect active split
        updateUser({ ...user, active_split_id: res.data.id });

        fetchData();
        setIsModalOpen(false);
      }
      else {
        alert(res.message);
      }
    });
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Meal <span className="text-primary-600">Splits</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
            Join forces with other foodies. Split the cost, share the joy, and enjoy premium meals for a fraction of the price.
          </p>
        </div>
        <button
          onClick={() => {
            if (!user) navigate('/login');
            else setIsModalOpen(true);
          }}
          className="group bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-primary-500/30 transition-all duration-300 flex items-center gap-2 font-semibold transform hover:-translate-y-0.5"
        >
          <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-300" />
          Start a New Split
        </button>
      </div>

      {msg && (
        <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl flex items-center animate-fade-in">
          <span className="mr-2">🎉</span> {msg}
        </div>
      )}

      {/* Splits Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
        {splits.map(split => {
          const isFull = split.people_joined_ids.length >= split.people_needed;
          const isClosed = split.is_closed;
          const joined = user && split.people_joined_ids.includes(user.id);

          // Requirement: Hide full splits from non-members
          if (isFull && !joined) return null;

          const progress = (split.people_joined_ids.length / split.people_needed) * 100;
          const vendor = vendors.find(v => v.id === split.vendor_id);

          return (
            <div key={split.id} className="group bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-2xl p-6 shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 transition-all duration-300 relative overflow-hidden">
              {/* Decorative gradient blob */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100"></div>

              <div className="flex justify-between items-start mb-6 relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-orange-200 dark:from-primary-900 dark:to-orange-900 rounded-2xl flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-xl shadow-inner overflow-hidden">
                    {vendor?.logo_url ? (
                      <img src={vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                    ) : (
                      split.creator_name[0]
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white leading-tight group-hover:text-primary-600 transition-colors">{split.dish_name}</h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-medium">@ {split.vendor_name}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-gray-300 dark:text-gray-600">#{split.id.slice(-4)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 relative">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Per Person</div>
                  <div className="font-bold text-2xl text-gray-900 dark:text-white">₹{(split.total_price / split.people_needed).toFixed(0)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl text-center border border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Slots</div>
                  <div className="font-bold text-2xl text-gray-900 dark:text-white">{split.people_joined_ids.length}<span className="text-gray-400 text-lg">/{split.people_needed}</span></div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>{split.people_joined_ids.length} joined</span>
                  <span>{split.people_needed - split.people_joined_ids.length} spots left</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Clock size={14} className="text-primary-500" /> {split.time_note}
                  </div>
                  {vendor && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                      <MapPin size={12} /> {vendor.location}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Creator OR Admin Logic */}
                  {user && (split.creator_id === user.id || user.role === 'admin') && (
                    <div className="flex gap-2">
                      {/* Mark Complete Button - CREATOR ONLY */}
                      {!isClosed && split.creator_id === user.id && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Mark this split as complete? This will close it.')) {
                              // @ts-ignore - markAsComplete added to mockDatabase
                              const res = await api.splits.markAsComplete(split.id);
                              if (res.success) {
                                setMsg(res.message);
                                fetchData();
                              } else {
                                alert(res.message);
                              }
                            }
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Mark as Complete"
                        >
                          <CheckSquare size={18} />
                        </button>
                      )}

                      {/* Delete Button (If alone OR Admin) */}
                      {(split.people_joined_ids.length === 1 || user.role === 'admin') && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this split?')) {
                              const res = await api.splits.delete(split.id);
                              if (res.success) {
                                setMsg(res.message);
                                fetchData();
                              } else {
                                alert(res.message);
                              }
                            }
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Split"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                      )}
                    </div>
                  )}

                  {joined ? (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Different message for creator transferring ownership
                        const confirmMsg = (split.creator_id === user?.id && split.people_joined_ids.length > 1)
                          ? 'Leaving will transfer ownership to the next member. Continue?'
                          : 'Are you sure you want to leave this split?';

                        if (confirm(confirmMsg)) {
                          const res = await api.splits.leave(split.id, user.id);
                          if (res.success) {
                            setMsg(res.message);
                            // Update local user state
                            updateUser({ ...user, active_split_id: null });
                            fetchData();
                            setTimeout(() => setMsg(''), 3000);
                          } else {
                            alert(res.message);
                          }
                        }
                      }}
                      className="px-5 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg font-semibold text-sm flex items-center gap-1 transition-colors"
                    >
                      <span>X</span> Leave
                    </button>
                  ) : (
                    !isClosed ? (
                      <button
                        onClick={() => handleJoin(split.id)}
                        disabled={isFull}
                        className={`px-6 py-2 rounded-lg font-semibold text-sm text-white shadow-md transition-all transform active:scale-95 ${isFull
                          ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-primary-600 to-orange-600 hover:from-primary-700 hover:to-orange-700 hover:shadow-primary-500/25'
                          }`}
                      >
                        {isFull ? 'Full' : 'Join Split'}
                      </button>
                    ) : (
                      <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg text-sm font-medium">Completed</span>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {splits.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-dark-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No active splits</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Be the first to start a delicious group meal!</p>
            <button onClick={() => {
              if (!user) navigate('/login');
              else setIsModalOpen(true);
            }} className="text-primary-600 font-semibold hover:underline">Create a Split Now</button>
          </div>
        )}
      </div>

      {/* How Meal Splitting Works Section */}
      <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white rounded-3xl p-10 shadow-xl dark:shadow-2xl relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>

        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-10 text-center">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center font-bold mb-6 text-primary-600 dark:text-primary-500 text-xl border border-gray-200 dark:border-gray-700 group-hover:border-primary-500/50 group-hover:scale-110 transition-all duration-300 shadow-sm dark:shadow-lg">1</div>
              <h4 className="font-bold text-lg mb-3">Find a Split</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">Browse available meal splits or create your own for a dish you want.</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center font-bold mb-6 text-primary-600 dark:text-primary-500 text-xl border border-gray-200 dark:border-gray-700 group-hover:border-primary-500/50 group-hover:scale-110 transition-all duration-300 shadow-sm dark:shadow-lg delay-100">2</div>
              <h4 className="font-bold text-lg mb-3">Join & Connect</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">Click "Join Split" to connect with others interested in the same meal.</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center font-bold mb-6 text-primary-600 dark:text-primary-500 text-xl border border-gray-200 dark:border-gray-700 group-hover:border-primary-500/50 group-hover:scale-110 transition-all duration-300 shadow-sm dark:shadow-lg delay-200">3</div>
              <h4 className="font-bold text-lg mb-3">Share & Save</h4>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">Split the cost, enjoy great food, and save money while making friends!</p>
            </div>
          </div>
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
