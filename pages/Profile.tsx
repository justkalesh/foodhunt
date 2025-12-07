
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/mockDatabase';
import { User, Review, MealSplit } from '../types';
import { User as UserIcon, Settings, Star, Utensils, Award, Edit3, Save, Sun, Moon, Monitor, CheckCircle } from 'lucide-react';

const Profile: React.FC = () => {
   const { user, logout, updateUser } = useAuth();
   const { theme, setTheme } = useTheme();
   const navigate = useNavigate();

   const [loading, setLoading] = useState(true);
   const [activity, setActivity] = useState<{ recentReviews: Review[], recentSplits: MealSplit[] }>({ recentReviews: [], recentSplits: [] });
   const [activeSplit, setActiveSplit] = useState<MealSplit | null>(null);
   const [isEditing, setIsEditing] = useState(false);
   const [formData, setFormData] = useState({ name: '', semester: '', pfp_url: '' });
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      if (!user) {
         navigate('/login');
         return;
      }

      // Init form data
      setFormData({
         name: user.name,
         semester: user.semester,
         pfp_url: user.pfp_url || ''
      });

      const fetchData = async () => {
         const actRes = await api.users.getActivity(user.id);
         if (actRes.success && actRes.data) {
            setActivity(actRes.data as any);
         }

         if (user.active_split_id) {
            const splitRes = await api.splits.getById(user.active_split_id);
            if (splitRes.success && splitRes.data) {
               setActiveSplit(splitRes.data);
            }
         } else {
            setActiveSplit(null);
         }

         setLoading(false);
      };
      fetchData();
   }, [user, navigate]);

   const handleSave = async () => {
      if (!user) return;
      setSaving(true);
      const res = await api.users.updateProfile(user.id, formData);
      if (res.success && res.data) {
         updateUser(res.data);
         setIsEditing(false);
      }
      setSaving(false);
   };



   const getLoyaltyBadge = (points: number) => {
      if (points >= 300) return { name: 'Gold Member', color: 'text-yellow-500', bg: 'bg-yellow-100', icon: <Award size={20} className="fill-current" /> };
      if (points >= 100) return { name: 'Silver Member', color: 'text-gray-500', bg: 'bg-gray-100', icon: <Award size={20} className="fill-current" /> };
      return { name: 'Bronze Member', color: 'text-orange-700', bg: 'bg-orange-100', icon: <Award size={20} className="fill-current" /> };
   };

   if (!user || loading) return <div className="p-10 text-center dark:text-white">Loading profile...</div>;

   const badge = getLoyaltyBadge(user.loyalty_points || 0);

   return (
      <div className="max-w-4xl mx-auto px-4 py-8">
         {/* Profile Header Card */}
         <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
               <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-700 shadow-inner bg-gray-50 dark:bg-dark-900 flex items-center justify-center text-gray-400">
                     {formData.pfp_url ? (
                        <img src={formData.pfp_url} alt="Profile" className="w-full h-full object-cover" />
                     ) : (
                        <UserIcon size={64} />
                     )}
                  </div>
                  {isEditing && (
                     <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                        <span className="text-white text-xs">Change URL</span>
                     </div>
                  )}
               </div>

               <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                     <div>
                        {isEditing ? (
                           <input
                              className="text-2xl font-bold border-b border-gray-300 dark:bg-dark-800 dark:text-white dark:border-gray-600 focus:outline-none focus:border-primary-500 mb-1 w-full md:w-auto"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                           />
                        ) : (
                           <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
                        )}

                        <div className="text-gray-500 dark:text-gray-400 font-mono text-sm mt-1">{user.email}</div>
                     </div>

                     <div className="flex flex-col items-center md:items-end gap-2">
                        <div className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 ${badge.bg} ${badge.color}`}>
                           {badge.icon} {badge.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                           {user.loyalty_points || 0} Points
                        </div>
                     </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
                     {isEditing ? (
                        <div className="flex items-center gap-2">
                           <label className="text-sm font-medium dark:text-gray-300">Sem:</label>
                           <input
                              className="w-16 p-1 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600"
                              value={formData.semester}
                              onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                           />
                        </div>
                     ) : (
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 rounded-md text-sm">
                           Semester {user.semester}
                        </span>
                     )}
                     <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-md text-sm capitalize">
                        {user.role}
                     </span>
                  </div>

                  {isEditing && (
                     <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Profile Photo URL</label>
                        <input
                           className="w-full text-sm p-2 border rounded dark:bg-dark-900 dark:text-white dark:border-gray-600"
                           placeholder="https://..."
                           value={formData.pfp_url}
                           onChange={(e) => setFormData({ ...formData, pfp_url: e.target.value })}
                        />
                     </div>
                  )}
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
               {isEditing ? (
                  <>
                     <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                     <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-2">
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
                     </button>
                  </>
               ) : (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                     <Edit3 size={16} /> Edit Profile
                  </button>
               )}
            </div>
         </div>

         <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column: Settings & Theme */}
            <div className="flex flex-col gap-6 h-full">
               <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                     <Settings size={18} /> App Settings
                  </h3>

                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">Theme Preference</label>
                        <div className="grid grid-cols-3 gap-2">
                           <button onClick={() => setTheme('light')} className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${theme === 'light' ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                              <Sun size={16} /> Light
                           </button>
                           <button onClick={() => setTheme('dark')} className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${theme === 'dark' ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                              <Moon size={16} /> Dark
                           </button>
                           <button onClick={() => setTheme('system')} className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${theme === 'system' ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                              <Monitor size={16} /> Auto
                           </button>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Customer Query & Help */}
               <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex-1 flex flex-col justify-center">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                     <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">?</div> Customer Query & Help
                  </h3>
                  <div className="space-y-3 text-sm">
                     <p className="text-gray-600 dark:text-gray-300">Need assistance? Contact us:</p>
                     <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600">
                        <div className="font-medium text-gray-900 dark:text-white mb-1">Message/Mail</div>
                        <a href="mailto:foodhunt101lpu@gmail.com" className="text-primary-600 hover:underline break-all">foodhunt101lpu@gmail.com</a>
                     </div>
                  </div>
               </div>
            </div>

            {/* Right Column: Activity */}
            <div className="md:col-span-2 space-y-6">

               {/* Recent Reviews */}
               <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                     <Star size={18} className="text-yellow-500" /> Recent Reviews
                  </h3>
                  <div className="space-y-4">
                     {activity.recentReviews.length > 0 ? activity.recentReviews.map(r => (
                        <div key={r.id} className="pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0 last:pb-0">
                           <div className="flex justify-between text-sm mb-1">
                              <span className="font-semibold dark:text-white">Vendor ID: {r.vendor_id}</span>
                              <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                           </div>
                           <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-1">"{r.review_text}"</p>
                        </div>
                     )) : <p className="text-gray-400 italic text-sm">No reviews yet.</p>}
                  </div>
               </div>

               {/* Joined Split */}
               <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                     <Utensils size={18} className="text-primary-500" /> Joined Split
                  </h3>
                  <div className="space-y-3">
                     {activeSplit ? (
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                           <div>
                              <div className="font-bold text-base dark:text-white">{activeSplit.dish_name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">at {activeSplit.vendor_name}</div>
                              <div className="text-xs text-primary-600 mt-1 font-medium">{activeSplit.time_note}</div>
                           </div>
                        </div>
                     ) : (
                        <p className="text-gray-400 italic text-sm">No active split joined. Join one to save money!</p>
                     )}
                  </div>
               </div>

               {/* Recent Meal Splits */}
               <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                     <Utensils size={18} className="text-gray-400" /> Recent Splits
                  </h3>
                  <div className="space-y-3">
                     {activity.recentSplits.length > 0 ? activity.recentSplits.slice(0, 1).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                           <div>
                              <div className="font-bold text-sm dark:text-white">{s.dish_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">at {s.vendor_name}</div>
                           </div>
                           <span className={`text-xs px-2 py-1 rounded-full ${s.is_closed ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                              {s.is_closed ? 'Closed' : 'Active'}
                           </span>
                        </div>
                     )) : <p className="text-gray-400 italic text-sm">No past meal splits.</p>}
                  </div>
               </div>

            </div>
         </div>
      </div>
   );
};

export default Profile;
