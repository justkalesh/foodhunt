
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/mockDatabase';
import { User, Review, MealSplit, UserRole } from '../types';
import { Settings, Star, Utensils, Award, Edit3, Save, Sun, Moon, Monitor, MessageCircle, Sparkles, TrendingUp, Users } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const Profile: React.FC = () => {
   const { user, logout, updateUser } = useAuth();
   const { userId } = useParams<{ userId: string }>();
   const { theme, setTheme } = useTheme();
   const navigate = useNavigate();

   const isOwnProfile = !userId || (user && user.id === userId);
   const [displayUser, setDisplayUser] = useState<User | null>(null);

   const [loading, setLoading] = useState(true);
   const [activity, setActivity] = useState<{ recentReviews: Review[], recentSplits: MealSplit[] }>({ recentReviews: [], recentSplits: [] });
   const [activeSplit, setActiveSplit] = useState<MealSplit | null>(null);
   const [isEditing, setIsEditing] = useState(false);
   const [formData, setFormData] = useState({ name: '', semester: '', pfp_url: '' });
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      if (isOwnProfile && !user) {
         navigate('/login');
         return;
      }

      const loadProfile = async () => {
         let targetUser = user;

         if (!isOwnProfile && userId) {
            const res = await api.users.getMe(userId);
            if (res.success && res.data) {
               targetUser = res.data;
            } else {
               setLoading(false);
               return;
            }
         }

         if (targetUser) {
            setDisplayUser(targetUser);
            setFormData({
               name: targetUser.name,
               semester: targetUser.semester,
               pfp_url: targetUser.pfp_url || ''
            });

            const actRes = await api.users.getActivity(targetUser.id);
            if (actRes.success && actRes.data) {
               setActivity(actRes.data as any);
            }

            if (targetUser.active_split_id) {
               const splitRes = await api.splits.getById(targetUser.active_split_id);
               if (splitRes.success && splitRes.data) {
                  setActiveSplit(splitRes.data);
               }
            } else {
               setActiveSplit(null);
            }
         }

         setLoading(false);
      };

      loadProfile();
   }, [user, navigate, userId, isOwnProfile]);

   const [imgError, setImgError] = useState(false);

   useEffect(() => {
      setImgError(false);
   }, [formData.pfp_url]);

   const handleSave = async () => {
      if (!displayUser) return;
      setSaving(true);
      const res = await api.users.updateProfile(displayUser.id, formData);
      if (res.success && res.data) {
         if (isOwnProfile) updateUser(res.data);
         setDisplayUser(res.data);
         setIsEditing(false);
      }
      setSaving(false);
   };

   const getLoyaltyBadge = (points: number) => {
      if (points >= 300) return { name: 'Gold Member', color: 'text-yellow-600', bg: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40', icon: <Award size={20} className="fill-current" /> };
      if (points >= 100) return { name: 'Silver Member', color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-800 dark:to-slate-800', icon: <Award size={20} className="fill-current" /> };
      return { name: 'Bronze Member', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40', icon: <Award size={20} className="fill-current" /> };
   };

   if (loading) return <PageLoading message="Loading profile..." />;
   if (!displayUser) return (
      <div className="min-h-screen flex items-center justify-center">
         <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
               <Users size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">User not found</h3>
            <p className="text-gray-500 dark:text-gray-400">This profile doesn't exist or has been removed.</p>
         </div>
      </div>
   );

   const badge = getLoyaltyBadge(displayUser.loyalty_points || 0);

   return (
      <div className="min-h-screen">
         {/* Hero Header */}
         <div className="relative overflow-hidden border-b border-gray-100 dark:border-gray-800">
            <div className="absolute inset-0 pointer-events-none">
               <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
               <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent-sky/10 rounded-full blur-3xl" />
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-12 pb-8 relative z-10">
               <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                  <Sparkles size={14} />
                  {isOwnProfile ? 'Your Profile' : 'Foodie Profile'}
               </span>
               <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
                  {isOwnProfile ? 'My ' : ''}<span className="text-primary-600">Profile</span>
               </h1>
               <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
                  {isOwnProfile ? 'Manage your account, settings, and view your activity.' : `View ${displayUser.name}'s profile and activity.`}
               </p>
            </div>
         </div>

         <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Profile Header Card */}
            <Card variant="default" className="mb-8 relative overflow-hidden">
               {/* Gradient blob decoration */}
               <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />

               <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                  {/* Avatar */}
                  <div className="relative group">
                     <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-700 shadow-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/50 dark:to-primary-800/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-5xl">
                        {formData.pfp_url && !imgError ? (
                           <img
                              src={formData.pfp_url}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              onError={() => setImgError(true)}
                           />
                        ) : (
                           <span>{(formData.name || '?')[0]?.toUpperCase()}</span>
                        )}
                     </div>
                     {isEditing && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                           <span className="text-white text-xs font-medium">Change URL</span>
                        </div>
                     )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                     <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                           {isEditing ? (
                              <input
                                 className="text-3xl font-extrabold border-b-2 border-primary-500 bg-transparent text-gray-900 dark:text-white focus:outline-none mb-1 w-full md:w-auto"
                                 value={formData.name}
                                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                           ) : (
                              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{displayUser.name}</h2>
                           )}

                           {(isOwnProfile || user?.role === UserRole.ADMIN) && (
                              <div className="text-gray-500 dark:text-gray-400 font-mono text-sm mt-1">{displayUser.email}</div>
                           )}
                           {displayUser.uid && (
                              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-mono">
                                 <span className="text-xs text-gray-500 dark:text-gray-400">UID:</span>
                                 <span className="font-bold">{displayUser.uid}</span>
                              </div>
                           )}
                        </div>

                        {/* Badge */}
                        <div className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm ${badge.bg} ${badge.color} border border-white/50 dark:border-gray-600`}>
                           {badge.icon} {badge.name}
                        </div>
                     </div>

                     <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
                        {isEditing ? (
                           <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Semester:</label>
                              <input
                                 className="w-16 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-slate-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
                                 value={formData.semester}
                                 onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                              />
                           </div>
                        ) : (
                           <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium">
                              Semester {displayUser.semester}
                           </span>
                        )}
                        <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded-lg text-sm font-medium capitalize">
                           {displayUser.role}
                        </span>
                     </div>

                     {isEditing && (
                        <div className="mt-4">
                           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Profile Photo URL</label>
                           <input
                              className="w-full text-sm px-4 py-2.5 border rounded-xl bg-white dark:bg-slate-700 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-primary-500"
                              placeholder="https://..."
                              value={formData.pfp_url}
                              onChange={(e) => setFormData({ ...formData, pfp_url: e.target.value })}
                           />
                        </div>
                     )}
                  </div>
               </div>

               {/* Actions */}
               <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                  {isOwnProfile ? (
                     isEditing ? (
                        <>
                           <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                           <Button onClick={handleSave} isLoading={saving} leftIcon={<Save size={16} />}>
                              {saving ? 'Saving...' : 'Save Profile'}
                           </Button>
                        </>
                     ) : (
                        <Button variant="ghost" onClick={() => setIsEditing(true)} leftIcon={<Edit3 size={16} />}>
                           Edit Profile
                        </Button>
                     )
                  ) : (
                     <Button
                        onClick={() => navigate(`/inbox?userId=${displayUser.id}&userName=${encodeURIComponent(displayUser.name)}`)}
                        leftIcon={<MessageCircle size={16} />}
                     >
                        Message
                     </Button>
                  )}
               </div>
            </Card>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
               {[
                  { label: 'Loyalty Points', value: displayUser.loyalty_points || 0, icon: TrendingUp, color: 'primary' },
                  { label: 'Reviews', value: activity.recentReviews.length, icon: Star, color: 'yellow' },
                  { label: 'Splits Joined', value: activity.recentSplits.length, icon: Users, color: 'sky' },
                  { label: 'Semester', value: displayUser.semester, icon: Award, color: 'lime' },
               ].map((stat, idx) => (
                  <Card key={idx} variant="default" padding="md" className="relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-20 h-20 bg-primary-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-primary-500/10 transition-all" />
                     <div className="relative z-10 text-center">
                        <div className={`w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center ${stat.color === 'primary' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' :
                           stat.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' :
                              stat.color === 'sky' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600' :
                                 'bg-lime-100 dark:bg-lime-900/30 text-lime-600'
                           }`}>
                           <stat.icon size={20} />
                        </div>
                        <div className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-1">
                           {stat.value}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
                           {stat.label}
                        </div>
                     </div>
                  </Card>
               ))}
            </div>

            <div className={`grid gap-6 ${isOwnProfile ? 'md:grid-cols-3' : 'grid-cols-1'}`}>
               {/* Left Column: Settings */}
               {isOwnProfile && (
                  <div className="flex flex-col gap-6">
                     <Card variant="default" className="relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
                        <div className="relative z-10">
                           <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                              <Settings size={18} /> App Settings
                           </h3>

                           <div>
                              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-3">Theme Preference</label>
                              <div className="grid grid-cols-3 gap-2">
                                 {[
                                    { value: 'light', icon: Sun, label: 'Light' },
                                    { value: 'dark', icon: Moon, label: 'Dark' },
                                    { value: 'system', icon: Monitor, label: 'Auto' },
                                 ].map((opt) => (
                                    <button
                                       key={opt.value}
                                       onClick={() => setTheme(opt.value as any)}
                                       className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all ${theme === opt.value
                                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 border-2 border-primary-500'
                                          : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-slate-600'
                                          }`}
                                    >
                                       <opt.icon size={18} />
                                       {opt.label}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </Card>

                     <Card variant="default" className="flex-1 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accent-sky/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
                        <div className="relative z-10">
                           <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 flex items-center justify-center text-xs font-bold">?</div>
                              Help & Support
                           </h3>
                           <div className="space-y-3 text-sm">
                              <p className="text-gray-600 dark:text-gray-400">Need assistance? Contact us:</p>
                              <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                                 <div className="font-semibold text-gray-900 dark:text-white mb-1">Email Support</div>
                                 <a href="mailto:foodhunt101lpu@gmail.com" className="text-primary-600 hover:underline break-all text-sm">
                                    foodhunt101lpu@gmail.com
                                 </a>
                              </div>
                           </div>
                        </div>
                     </Card>
                  </div>
               )}

               {/* Right Column: Activity */}
               <div className={`${isOwnProfile ? 'md:col-span-2' : 'w-full'} space-y-6`}>
                  {/* Recent Reviews */}
                  <Card variant="default" className="relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                     <div className="relative z-10">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                           <Star size={18} className="text-yellow-500" /> Recent Reviews
                        </h3>
                        <div className="space-y-3">
                           {activity.recentReviews.length > 0 ? activity.recentReviews.map(r => (
                              <div key={r.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                 <div className="flex justify-between text-sm mb-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">{(r as any).vendor_name || r.vendor_id}</span>
                                    <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                                 </div>
                                 <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">"{r.review_text}"</p>
                              </div>
                           )) : <p className="text-gray-400 italic text-sm">No reviews yet.</p>}
                        </div>
                     </div>
                  </Card>

                  {/* Active Split */}
                  <Card variant="default" className="relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                     <div className="relative z-10">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                           <Utensils size={18} className="text-primary-500" /> Active Split
                        </h3>
                        {activeSplit ? (
                           <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-orange-50 dark:from-primary-900/20 dark:to-orange-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                              <div>
                                 <div className="font-bold text-lg text-gray-900 dark:text-white">{activeSplit.dish_name}</div>
                                 <div className="text-sm text-gray-500 dark:text-gray-400">at {activeSplit.vendor_name}</div>
                                 <div className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">{activeSplit.time_note}</div>
                              </div>
                              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-lg text-sm font-semibold">
                                 Active
                              </span>
                           </div>
                        ) : (
                           <p className="text-gray-400 italic text-sm">No active split joined. Join one to save money!</p>
                        )}
                     </div>
                  </Card>

                  {/* Recent Splits */}
                  <Card variant="default" className="relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-accent-sky/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                     <div className="relative z-10">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                           <Users size={18} className="text-sky-500" /> Recent Splits
                        </h3>
                        <div className="space-y-3">
                           {activity.recentSplits.filter(s => s.is_closed).length > 0 ? activity.recentSplits.filter(s => s.is_closed).slice(0, 1).map(s => (
                              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                 <div>
                                    <div className="font-bold text-sm text-gray-900 dark:text-white">{s.dish_name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">at {s.vendor_name}</div>
                                 </div>
                                 <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${s.is_closed
                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    }`}>
                                    {s.is_closed ? 'Closed' : 'Active'}
                                 </span>
                              </div>
                           )) : <p className="text-gray-400 italic text-sm">No past meal splits.</p>}
                        </div>
                     </div>
                  </Card>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Profile;
