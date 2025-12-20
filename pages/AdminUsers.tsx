
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { User, UserRole } from '../types';
import { Lock, Unlock, Plus, MessageSquare, X, Bell } from 'lucide-react';
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
  const [rewardData, setRewardData] = useState({ target: 'all', userId: '', amount: '50' });

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

  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'points_high') {
      return (b.loyalty_points || 0) - (a.loyalty_points || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
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
      targetIds = users.map(u => u.id);
    } else if (rewardData.userId) {
      targetIds = [rewardData.userId];
    } else {
      return alert("Please select a user");
    }

    for (const id of targetIds) {
      await api.admin.users.rewardPoints([id], amount);
    }
    alert(`Successfully rewarded ${targetIds.length} user(s) with ${amount} points!`);
    setIsRewardModalOpen(false);
    setRewardData({ target: 'all', userId: '', amount: '50' });
    fetchUsers();
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
    navigate(`/inbox?userId=${u.id}`);
  };

  const openPushModal = (u: User) => {
    setPushTarget(u);
    setPushData({ title: '', body: '' });
    setIsPushModalOpen(true);
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTarget) return;
    if (!pushData.title || !pushData.body) return alert("Title and Body are required");

    try {
      const isAllUsers = pushTarget.id === 'ALL';
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushData.title,
          body: pushData.body,
          targetUserId: isAllUsers ? null : pushTarget.id,
          sendToAll: isAllUsers
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setIsPushModalOpen(false);
      } else {
        alert(data.message);
      }
    } catch (err: any) {
      alert('Failed to send: ' + err.message);
    }
  };

  if (loading) return <PageLoading message="Loading users..." />;

  // ===== CHILD COMPONENT - NO PAGE WRAPPER, JUST TOOLBAR + TABLE + MODALS =====
  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="points_high">Most Points</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsRewardModalOpen(true)}
            className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all hover:-translate-y-0.5"
          >
            <span className="text-lg">$</span> Reward
          </button>
          <button
            onClick={() => openPushModal({ id: 'ALL', name: 'ALL USERS', email: '', role: UserRole.STUDENT, semester: '', loyalty_points: 0, is_disabled: false, created_at: '' })}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all hover:-translate-y-0.5"
          >
            <Bell size={18} /> Broadcast
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all hover:-translate-y-0.5"
          >
            <Plus size={18} /> Add User
          </button>
        </div>
      </div>

      {/* Table */}
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

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
              <button onClick={() => setIsEditModalOpen(false)}><X size={24} className="text-gray-500" /></button>
            </div>
            <form onSubmit={submitEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">PFP URL</label>
                <input value={editFormData.pfp_url} onChange={e => setEditFormData({ ...editFormData, pfp_url: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>
              <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-xl font-bold">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Reward Modal */}
      {isRewardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reward Loyalty Points</h2>
              <button onClick={() => setIsRewardModalOpen(false)}><X size={24} className="text-gray-500" /></button>
            </div>
            <form onSubmit={handleReward} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Target</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-gray-700 dark:text-white">
                    <input type="radio" checked={rewardData.target === 'all'} onChange={() => setRewardData({ ...rewardData, target: 'all' })} /> All Users
                  </label>
                  <label className="flex items-center gap-2 text-gray-700 dark:text-white">
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
                      className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:text-white dark:border-slate-700"
                      list="user-list"
                      onInput={(e: React.FormEvent<HTMLInputElement>) => {
                        const val = e.currentTarget.value;
                        const u = users.find(user => user.name === val || user.email === val);
                        if (u) {
                          setRewardData({ ...rewardData, userId: u.id });
                        } else if (rewardData.userId) {
                          setRewardData({ ...rewardData, userId: '' });
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
                <input type="number" value={rewardData.amount} onChange={e => setRewardData({ ...rewardData, amount: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:text-white dark:border-slate-700" />
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white py-2 rounded-xl font-bold">Send Points</button>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New User</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                <input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                <input required value={newUser.semester} onChange={e => setNewUser({ ...newUser, semester: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input required type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                  <option value={UserRole.STUDENT}>Student</option>
                  <option value={UserRole.VENDOR}>Vendor</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-xl font-bold hover:bg-primary-700">Create User</button>
            </form>
          </div>
        </div>
      )}

      {/* Push Notification Modal */}
      {isPushModalOpen && pushTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Send Push Notification</h2>
              <button onClick={() => setIsPushModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleSendPush} className="p-6 space-y-4">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">To: <span className="font-bold text-gray-900 dark:text-white">{pushTarget.name}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input required value={pushData.title} onChange={e => setPushData({ ...pushData, title: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message Body</label>
                <textarea required value={pushData.body} onChange={e => setPushData({ ...pushData, body: e.target.value })} className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" rows={4} />
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-xl font-bold hover:from-orange-600 hover:to-red-600">Send Notification</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
