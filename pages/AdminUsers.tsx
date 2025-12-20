
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { User, UserRole } from '../types';
import { ChevronLeft, Lock, Unlock, Plus, MessageSquare, X, Bell, Shield, Store, Users, LayoutDashboard, Sparkles } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';

const AdminUsers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', semester: '', password: '', role: UserRole.STUDENT });

  // Push Notification Modal
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushTarget, setPushTarget] = useState<User | null>(null);
  const [pushData, setPushData] = useState({ title: '', body: '' });

  // Edit User Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', pfp_url: '' });

  // Reward Modal
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [rewardData, setRewardData] = useState({ target: 'all', userId: '', amount: '50' }); // target: 'all' or 'single'

  // Sort State
  type SortOption = 'newest' | 'oldest' | 'points_high';
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    if (user && user.role !== UserRole.ADMIN) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await api.admin.users.getAll();
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoading(false);
  };

  // Computed sorted users
  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'points_high') {
      return (b.loyalty_points || 0) - (a.loyalty_points || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // Default 'newest'
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleToggleStatus = async (targetUserId: string) => {
    if (targetUserId === user?.id) {
      alert("You cannot disable your own admin account.");
      return;
    }
    await api.admin.users.toggleStatus(targetUserId);
    fetchUsers();
  };

  const handleEditUser = (u: User) => {
    setEditUser(u);
    setEditFormData({ name: u.name, pfp_url: u.pfp_url || '' });
    setIsEditModalOpen(true);
  };

  const submitEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const res = await api.users.updateProfile(editUser.id, editFormData);
    if (res.success) {
      setIsEditModalOpen(false);
      fetchUsers();
    } else {
      alert(res.message);
    }
  };

  const handleReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(rewardData.amount);
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");

    let targetIds: string[] = [];
    if (rewardData.target === 'all') {
      targetIds = users.filter(u => u.role === UserRole.STUDENT).map(u => u.id); // Only reward students? Or everyone? User said "everyone at once".
      // Let's reward everyone including other admins/vendors if wanted, but mostly students.
      // User asked "users".
    } else {
      if (!rewardData.userId) return alert("Select a user");
      targetIds = [rewardData.userId];
    }

    if (targetIds.length === 0) return alert("No users found to reward.");

    // @ts-ignore
    const res = await api.admin.users.rewardPoints(targetIds, amount);
    if (res.success) {
      alert(res.message);
      setIsRewardModalOpen(false);
      fetchUsers();
    } else {
      alert(res.message);
    }
  };


  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.admin.users.create(newUser);
    if (res.success) {
      setIsAddModalOpen(false);
      setNewUser({ email: '', name: '', semester: '', password: '', role: UserRole.STUDENT });
      fetchUsers();
    } else {
      alert(res.message);
    }
  };

  const handleMessageUser = (u: User) => {
    navigate(`/inbox?userId=${u.id}&userName=${encodeURIComponent(u.name)}&userEmail=${encodeURIComponent(u.email)}`);
  };

  const openPushModal = (u: User) => {
    setPushTarget(u);
    setPushData({ title: 'Announcement', body: '' });
    setIsPushModalOpen(true);
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTarget) return;

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pushTarget.id,
          title: pushData.title,
          body: pushData.body
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Push Notification Sent!');
        setIsPushModalOpen(false);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err: any) {
      alert('Failed to send: ' + err.message);
    }
  };

  if (loading) return <PageLoading message="Loading users..." />;

  return (
    <div className="min-h-screen">
      {/* Hero Header with Tab Navigation */}
      <div className="relative overflow-hidden border-b border-gray-100 dark:border-slate-800">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent-sky/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-12 pb-8 relative z-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
                <Users size={32} />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-2">
                  <Sparkles size={14} />
                  Admin Access
                </span>
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Manage <span className="text-primary-600">Users</span>
                </h1>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="points_high">Most Points</option>
                </select>
              </div>
              <button
                onClick={() => setIsRewardModalOpen(true)}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all hover:-translate-y-0.5"
              >
                <span className="text-lg">$</span> Reward
              </button>
              <button
                onClick={() => openPushModal({ id: 'ALL', name: 'ALL USERS', email: '', role: UserRole.STUDENT, semester: '', loyalty_points: 0, is_disabled: false, created_at: '' })}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition-all hover:-translate-y-0.5"
              >
                <Bell size={18} /> Broadcast
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg hover:shadow-primary-500/30 transition-all hover:-translate-y-0.5"
              >
                <Plus size={18} /> Add User
              </button>
            </div>
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
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${tab.id === 'users'
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User Info</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Semester</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Loyalty</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/profile/${u.id}`} className="flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-slate-700">
                          {u.pfp_url ? <img src={u.pfp_url} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 text-lg">{u.name[0]}</div>}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{u.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === UserRole.ADMIN
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                        }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {u.semester}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-primary-600">{u.loyalty_points || 0}</span>
                      <span className="text-xs text-gray-400 ml-1">pts</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end items-center gap-2">
                      <button
                        onClick={() => handleEditUser(u)}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      </button>

                      {u.role !== UserRole.ADMIN && (
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${u.is_disabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200'
                            }`}
                        >
                          {u.is_disabled ? <><Unlock size={14} /> Enable</> : <><Lock size={14} /> Disable</>}
                        </button>
                      )}

                      <button
                        onClick={() => handleMessageUser(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-200 transition-colors"
                      >
                        <MessageSquare size={14} /> Msg
                      </button>
                      <button
                        onClick={() => openPushModal(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-200 transition-colors"
                      >
                        <Bell size={14} /> Push
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit User Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Edit User</h2>
                <button onClick={() => setIsEditModalOpen(false)}><X size={24} className="text-gray-500" /></button>
              </div>
              <form onSubmit={submitEditUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">PFP URL</label>
                  <input value={editFormData.pfp_url} onChange={e => setEditFormData({ ...editFormData, pfp_url: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600" />
                </div>
                <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold">Save Changes</button>
              </form>
            </div>
          </div>
        )}

        {/* Reward Modal */}
        {isRewardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Reward Loyalty Points</h2>
                <button onClick={() => setIsRewardModalOpen(false)}><X size={24} className="text-gray-500" /></button>
              </div>
              <form onSubmit={handleReward} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Target</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 dark:text-white">
                      <input type="radio" checked={rewardData.target === 'all'} onChange={() => setRewardData({ ...rewardData, target: 'all' })} /> All Users
                    </label>
                    <label className="flex items-center gap-2 dark:text-white">
                      <input type="radio" checked={rewardData.target === 'single'} onChange={() => setRewardData({ ...rewardData, target: 'single' })} /> Specific User
                    </label>
                  </div>
                </div>

                {rewardData.target === 'single' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select User</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search user..."
                        className="w-full p-2 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600"
                        list="user-list"
                        onChange={(e) => {
                          // If we had a local 'searchTerm' state, we'd update it here.
                          // But to fix the "can't type" issue without adding a new state variable to the top-level component (which forces a re-render of the whole table),
                          // we can use the default behavior of input with datalist, BUT we must NOT force 'value' to be the resolved name unless it's a match.
                          // Actually, the issue is that 'value' prop is controlled by state that gets updated onInput.
                          // Simpler fix: Remove 'value' prop (make it uncontrolled) OR use a local state variable inside a small wrapper?
                          // I'll stick to the controlled component pattern but relax the matching logic.
                          // Wait, the previous code had `value={users.find...?.name}`. That resets the input to "Bob" as soon as you type "B" (if Bob matches) or empty string.
                          // I will change this input to be UNCONTROLLED (defaultValue) or manage a separate 'searchValue' state.
                          // Given I can't easily add generic state here without refactoring, I will use a local state `searchTerm` in the Modal block? No, Modals are conditonal.
                          // I'll just change `value` to NOT be forced.
                        }}
                        onInput={(e: React.FormEvent<HTMLInputElement>) => {
                          const val = e.currentTarget.value;
                          // Attempt to match
                          const u = users.find(user => user.name === val || user.email === val);
                          if (u) {
                            setRewardData({ ...rewardData, userId: u.id });
                          } else {
                            // If cleared or typing, ensure we don't accidentally keep the old ID if name doesn't match?
                            // Actually, allow free typing for search, but ID only sets on match.
                            if (rewardData.userId && !u) {
                              setRewardData({ ...rewardData, userId: '' });
                            }
                          }
                        }}
                      />
                      <datalist id="user-list">
                        {users.map(u => <option key={u.id} value={u.name}>{u.email}</option>)}
                      </datalist>
                      <p className="text-xs text-gray-500 mt-1">Start typing name to search</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Points Amount</label>
                  <input type="number" value={rewardData.amount} onChange={e => setRewardData({ ...rewardData, amount: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600" />
                </div>

                <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg font-bold">Send Points</button>
              </form>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Add New User</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  <input required value={newUser.semester} onChange={e => setNewUser({ ...newUser, semester: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input required type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white">
                    <option value={UserRole.STUDENT}>Student</option>
                    <option value={UserRole.VENDOR}>Vendor</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700">Create User</button>
              </form>
            </div>
          </div>
        )}

        {/* Push Notification Modal */}
        {isPushModalOpen && pushTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Send Push Notification</h2>
                <button onClick={() => setIsPushModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
              </div>
              <form onSubmit={handleSendPush} className="p-6 space-y-4">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">To: <span className="font-bold text-gray-900 dark:text-white">{pushTarget.name}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input required value={pushData.title} onChange={e => setPushData({ ...pushData, title: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body</label>
                  <textarea required value={pushData.body} onChange={e => setPushData({ ...pushData, body: e.target.value })} className="w-full p-2 border rounded dark:bg-dark-900 dark:border-gray-600 dark:text-white" rows={4} />
                </div>
                <button type="submit" className="w-full bg-orange-600 text-white py-2 rounded-lg font-bold hover:bg-orange-700">Send Notification</button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminUsers;
