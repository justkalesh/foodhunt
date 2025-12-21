
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/mockDatabase';
import { Vendor, Review, MenuItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, DollarSign, Star, ChevronLeft, Send, Flame, Trash2, Eye, X, Phone, Share2, TrendingUp, Utensils, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

// ============================================
// PROGRESS RING COMPONENT
// ============================================
interface ProgressRingProps {
    progress: number;
    size?: number;
    strokeWidth?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({ progress, size = 64, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg className="progress-ring transform -rotate-90" width={size} height={size}>
            <circle
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-700"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            <circle
                stroke="url(#vendorProgressGradient)"
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                r={radius}
                cx={size / 2}
                cy={size / 2}
                className="transition-all duration-700"
            />
            <defs>
                <linearGradient id="vendorProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
            </defs>
        </svg>
    );
};

// ============================================
// RATING BREAKDOWN COMPONENT
// ============================================
const RatingBreakdown = ({ reviews }: { reviews: Review[] }) => {
    const total = reviews.length;
    const counts = [5, 4, 3, 2, 1].map(star => reviews.filter(r => r.rating === star).length);

    return (
        <div className="space-y-2 mb-6">
            {[5, 4, 3, 2, 1].map((star, idx) => {
                const pct = total > 0 ? (counts[idx] / total) * 100 : 0;
                return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                        <span className="w-8 text-gray-500 dark:text-gray-400">{star}★</span>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <span className="w-8 text-xs text-gray-400">{counts[idx]}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================
// CATEGORY SECTION COMPONENT
// ============================================
const CategorySection = ({ title, items }: { title: string, items: MenuItem[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    const renderPrice = (item: MenuItem) => {
        const hasSmall = item.small_price != null;
        const hasMedium = item.medium_price != null;
        const hasLarge = item.large_price != null;
        const hasXl = item.xl_price != null;
        const hasSizes = hasSmall || hasMedium || hasLarge || hasXl;

        if (hasSizes) {
            const sizes = [];
            if (hasSmall) sizes.push(`S: ₹${item.small_price}`);
            if (hasMedium) sizes.push(`M: ₹${item.medium_price}`);
            if (hasLarge) sizes.push(`L: ₹${item.large_price}`);
            if (hasXl) sizes.push(`XL: ₹${item.xl_price}`);
            return <span className="font-bold text-green-600 text-sm">{sizes.join(' | ')}</span>;
        }
        return <span className="font-bold text-green-600">₹{item.price}</span>;
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                type="button"
            >
                <span className="font-bold text-gray-900 dark:text-white text-lg">{title}</span>
                <ChevronLeft size={20} className={`transform transition-transform text-gray-500 ${isOpen ? '-rotate-90' : 'rotate-180'}`} />
            </button>
            {isOpen && (
                <div className="bg-white dark:bg-dark-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    {item.name}
                                    {item.is_recommended && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-200"><Star size={10} className="fill-current" /> Recommended</span>}
                                </h3>
                            </div>
                            {renderPrice(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================
const VendorDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRating, setNewRating] = useState(5);
    const [newReviewText, setNewReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);

    // Scroll state for floating action bar
    const [scrollY, setScrollY] = useState(0);
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Set data attribute on body when floating action bar is visible (for chatbot positioning)
    useEffect(() => {
        const isFloatingBarVisible = scrollY > 200;
        // Only apply on mobile (md breakpoint is 768px)
        const isMobile = window.innerWidth < 768;

        if (isFloatingBarVisible && isMobile) {
            document.body.setAttribute('data-floating-bar', 'true');
        } else {
            document.body.removeAttribute('data-floating-bar');
        }

        return () => {
            document.body.removeAttribute('data-floating-bar');
        };
    }, [scrollY]);

    useEffect(() => {
        if (showMenuModal) setCurrentImageIndex(0);
    }, [showMenuModal]);

    useEffect(() => {
        if (showListModal && id && menuItems === null) {
            api.vendors.getMenuItems(id).then(res => {
                if (res.success && res.data) setMenuItems(res.data);
                else setMenuItems([]);
            });
        }
    }, [showListModal, id, menuItems]);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            const vRes = await api.vendors.getById(id);
            if (vRes.success && vRes.data) setVendor(vRes.data);
            const rRes = await api.vendors.getReviews(id);
            if (rRes.success && rRes.data) setReviews(rRes.data);
            setLoading(false);
        };
        fetchData();
    }, [id]);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id) return;
        setSubmitting(true);
        const res = await api.vendors.addReview(id, user.id, newRating, newReviewText);
        if (res.success && res.data) {
            setReviews([res.data, ...reviews]);
            setNewReviewText('');
            if (vendor) {
                const newCount = (vendor.rating_count || 0) + 1;
                const newAvg = ((vendor.rating_avg || 0) * (vendor.rating_count || 0) + newRating) / newCount;
                setVendor({ ...vendor, rating_avg: parseFloat(newAvg.toFixed(1)), rating_count: newCount });
            }
        }
        setSubmitting(false);
    };

    const handleDeleteReview = async (reviewId: string) => {
        if (!window.confirm("Delete this review?")) return;
        const res = await api.vendors.deleteReview(reviewId);
        if (res.success) {
            setReviews(reviews.filter(r => r.id !== reviewId));
            if (vendor) {
                const reviewToDelete = reviews.find(r => r.id === reviewId);
                if (reviewToDelete) {
                    const newCount = (vendor.rating_count || 1) - 1;
                    const oldTotal = (vendor.rating_avg || 0) * (vendor.rating_count || 0);
                    const newAvg = newCount > 0 ? (oldTotal - reviewToDelete.rating) / newCount : 0;
                    setVendor({ ...vendor, rating_avg: parseFloat(newAvg.toFixed(1)), rating_count: newCount });
                }
            }
        }
    };

    const handleShare = async () => {
        if (!vendor) return;
        if (navigator.share) {
            try {
                await navigator.share({ title: `Food Hunt - ${vendor.name}`, text: `Check out ${vendor.name} on Food Hunt!`, url: window.location.href });
            } catch (error) { console.error('Error sharing:', error); }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center dark:text-white">Loading Vendor Details...</div>;
    if (!vendor) return <div className="p-10 text-center dark:text-white">Vendor not found.</div>;

    const rushColors: Record<string, string> = {
        high: 'from-red-500 to-rose-600',
        medium: 'from-yellow-500 to-amber-600',
        low: 'from-green-500 to-emerald-600',
    };

    return (
        <div className="relative min-h-screen bg-gray-50 dark:bg-dark-900 overflow-hidden transition-colors duration-300">
            {/* Glass Blob Background */}
            <div className="absolute top-1/3 right-0 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-accent-sky/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* HERO WITH PARALLAX EFFECT */}
            <div ref={heroRef} className="relative h-72 md:h-96 w-full z-10 overflow-hidden">
                <img
                    src={vendor.menu_image_urls?.[0] || vendor.logo_url}
                    alt={vendor.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-100"
                    style={{ transform: `translateY(${scrollY * 0.3}px) scale(1.1)` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Back & Share buttons */}
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
                    <Link to="/vendors" className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-full backdrop-blur-sm transition-colors">
                        <ChevronLeft size={18} /> Back to List
                    </Link>
                    <button onClick={handleShare} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors" title="Share">
                        <Share2 size={20} />
                    </button>
                </div>

                {/* HUGE VENDOR NAME OVERLAY */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-20">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-end gap-4 md:gap-6">
                            {vendor.logo_url && (
                                <img src={vendor.logo_url} alt="Logo" loading="lazy" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-4 border-white shadow-2xl object-cover" />
                            )}
                            <div className="flex-1">
                                <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">{vendor.name}</h1>
                                <div className="flex flex-wrap gap-4 mt-3 text-white/90 text-sm font-medium">
                                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm"><MapPin size={14} /> {vendor.location}</span>
                                    {vendor.contact_number && <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm"><Phone size={14} /> {vendor.contact_number}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-8 relative z-10">

                {/* LEFT COLUMN */}
                <div className="md:col-span-2 space-y-6">

                    {/* BENTO STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Rush Level Card */}
                        <div className={`col-span-1 bg-gradient-to-br ${rushColors[vendor.rush_level] || rushColors.low} p-5 rounded-2xl text-white relative overflow-hidden shadow-lg`}>
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                <span className="text-xs font-medium uppercase tracking-wider opacity-80">Live</span>
                            </div>
                            <Flame size={24} className="mb-2 opacity-80" />
                            <div className="text-xs uppercase tracking-wider opacity-80">Rush Level</div>
                            <div className="text-2xl font-bold uppercase mt-1">{vendor.rush_level}</div>
                        </div>

                        {/* Price Card */}
                        <div className="col-span-1 bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                            <DollarSign size={20} className="text-green-600 mb-2" />
                            <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Avg Meal</div>
                            <div className="text-4xl font-extrabold text-gray-900 dark:text-white">₹{vendor.avg_price_per_meal}</div>
                            <div className="text-xs text-gray-400 mt-1">per person</div>
                        </div>

                        {/* Popularity Card with Progress Ring */}
                        <div className="col-span-1 bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm flex flex-col items-center justify-center">
                            <div className="relative">
                                <ProgressRing progress={vendor.popularity_score || 0} size={72} strokeWidth={6} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">{vendor.popularity_score}%</span>
                                </div>
                            </div>
                            <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-2">Popularity</div>
                        </div>

                        {/* Cuisine Card */}
                        <div className="col-span-1 bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                            <Utensils size={20} className="text-primary-600 mb-2" />
                            <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Cuisine</div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{vendor.cuisine}</div>
                            <div className="text-xs text-primary-500 mt-1">{vendor.origin_tag}</div>
                        </div>
                    </div>

                    {/* ABOUT SECTION */}
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-2xl border dark:border-gray-700 shadow-sm">
                        <h2 className="text-xl font-bold mb-3 dark:text-white flex items-center gap-2"><Sparkles size={20} /> About</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{vendor.description}</p>
                    </div>

                    {/* FEATURED SPOTLIGHT - Menu Section */}
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-2xl border dark:border-gray-700 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><DollarSign size={20} /> Menu Highlights</h2>
                            <button onClick={() => setShowListModal(true)} className="text-sm bg-primary-100 hover:bg-primary-200 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors font-medium">
                                <Eye size={16} /> View Full Menu
                            </button>
                        </div>

                        {/* Featured Item with Glow */}
                        {vendor.recommended_item_name && (
                            <div className="relative mb-6 group">
                                {/* Glow Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-60" />
                                <div className="relative bg-gradient-to-r from-purple-50 to-primary-50 dark:from-purple-900/30 dark:to-primary-900/30 p-5 rounded-2xl border border-purple-200 dark:border-purple-700/50">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Star size={20} className="text-yellow-500 fill-current" />
                                        <span className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">Chef's Recommendation</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{vendor.recommended_item_name}</span>
                                        <span className="text-2xl font-bold text-green-600">₹{vendor.recommended_item_price}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Menu Preview Image */}
                        <div className="aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 relative group cursor-pointer border dark:border-gray-700" onClick={() => setShowMenuModal(true)}>
                            {vendor.menu_image_urls && vendor.menu_image_urls.length > 0 ? (
                                <>
                                    <img src={vendor.menu_image_urls[0]} alt="Menu Preview" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <span className="bg-white/95 text-gray-900 px-5 py-2.5 rounded-full font-bold shadow-xl transform scale-90 group-hover:scale-100 transition-all">
                                            {vendor.menu_image_urls.length > 1 ? `View ${vendor.menu_image_urls.length} Menu Pages` : 'View Menu'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No menu images available</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN - Reviews */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-2xl border dark:border-gray-700 shadow-sm sticky top-24">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold dark:text-white">Reviews</h3>
                            <div className="flex items-center gap-1 text-yellow-500 font-bold text-2xl">
                                <Star className="fill-current" size={24} /> {vendor.rating_avg}
                                <span className="text-gray-400 text-sm font-normal ml-1">({vendor.rating_count})</span>
                            </div>
                        </div>

                        {/* Rating Breakdown Bars */}
                        <RatingBreakdown reviews={reviews} />

                        {/* Add Review Form */}
                        {user ? (
                            <form onSubmit={handleSubmitReview} className="mb-6 pb-6 border-b dark:border-gray-700">
                                <h4 className="text-sm font-bold mb-2 dark:text-white">Write a Review</h4>
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <button key={num} type="button" onClick={() => setNewRating(num)} className={`${num <= newRating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'} transition-colors hover:scale-110`}>
                                            <Star className="fill-current" size={28} />
                                        </button>
                                    ))}
                                </div>
                                <textarea required value={newReviewText} onChange={e => setNewReviewText(e.target.value)} placeholder="How was the food?" className="w-full p-3 rounded-xl border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 mb-3" rows={3} />
                                <Button type="submit" disabled={submitting} className="w-full" leftIcon={<Send size={16} />}>
                                    {submitting ? 'Posting...' : 'Post Review'}
                                </Button>
                            </form>
                        ) : (
                            <div className="bg-gray-50 dark:bg-dark-900 p-4 rounded-xl text-center text-sm text-gray-500 mb-6">
                                <Link to="/login" className="text-primary-600 font-bold hover:underline">Log in</Link> to write a review.
                            </div>
                        )}

                        {/* Reviews List */}
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {reviews.length === 0 ? (
                                <p className="text-center text-gray-400 italic py-4">No reviews yet. Be the first!</p>
                            ) : (
                                reviews.map(r => (
                                    <div key={r.id} className="pb-4 border-b dark:border-gray-700 last:border-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">{r.user_name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                                {user?.role === 'admin' && (
                                                    <button onClick={() => handleDeleteReview(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex text-yellow-400 text-xs mb-2">
                                            {[...Array(5)].map((_, i) => <Star key={i} size={12} className={i < r.rating ? 'fill-current' : 'text-gray-200 dark:text-gray-700'} />)}
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm">{r.review_text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* FLOATING ACTION BAR (Mobile Only) */}
            <div className={`fixed bottom-6 left-4 right-4 z-40 transition-all duration-300 md:hidden ${scrollY > 200 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="glass dark:glass-dark rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowListModal(true)} leftIcon={<Eye size={16} />}>
                        View Menu
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => navigate('/splits')} leftIcon={<TrendingUp size={16} />}>
                        Start Split
                    </Button>
                </div>
            </div>

            {/* Full Screen Menu Modal (Image Preview) */}
            {showMenuModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowMenuModal(false)}>
                    <button onClick={() => setShowMenuModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white z-50"><X size={32} /></button>
                    <div className="relative max-w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <img src={vendor.menu_image_urls?.[currentImageIndex]} alt={`Menu Page ${currentImageIndex + 1}`} loading="lazy" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                        {vendor.menu_image_urls && vendor.menu_image_urls.length > 1 && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev > 0 ? prev - 1 : (vendor.menu_image_urls?.length || 1) - 1); }} className="absolute left-[-50px] top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"><ChevronLeft size={32} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev < (vendor.menu_image_urls?.length || 1) - 1 ? prev + 1 : 0); }} className="absolute right-[-50px] top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"><ChevronLeft size={32} className="rotate-180" /></button>
                                <div className="mt-4 flex gap-2 justify-center">
                                    {vendor.menu_image_urls.map((_, idx) => (
                                        <button key={idx} onClick={() => setCurrentImageIndex(idx)} className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`} />
                                    ))}
                                </div>
                                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">{currentImageIndex + 1} / {vendor.menu_image_urls.length}</div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Full Screen Menu List Modal */}
            {showListModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowListModal(false)}>
                    <div className="bg-white dark:bg-dark-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><DollarSign size={20} /> Menu List</h2>
                            <button onClick={() => setShowListModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            {menuItems === null ? (
                                <p className="text-center text-gray-500 py-8">Loading menu items...</p>
                            ) : menuItems.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No menu listed</p>
                            ) : (
                                <div className="space-y-4">
                                    {(() => {
                                        const grouped = menuItems.reduce((acc, item) => {
                                            const cat = item.category || 'General';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(item);
                                            return acc;
                                        }, {} as Record<string, MenuItem[]>);
                                        return Object.entries(grouped).map(([category, items]) => (
                                            <div key={category}><CategorySection title={category} items={items} /></div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorDetail;
