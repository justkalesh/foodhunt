
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/mockDatabase';
import { Vendor, Review, MenuItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Clock, DollarSign, Star, ChevronLeft, Send, Flame, BarChart, Trash2, Eye, X, Phone, Share2, ChevronDown, ChevronUp } from 'lucide-react';

const CategorySection = ({ title, items }: { title: string, items: MenuItem[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Helper to render price display
    const renderPrice = (item: MenuItem) => {
        // Check for actual valid size prices (not null and not undefined)
        const hasSmall = item.small_price != null;
        const hasMedium = item.medium_price != null;
        const hasLarge = item.large_price != null;
        const hasSizes = hasSmall || hasMedium || hasLarge;

        if (hasSizes) {
            const sizes = [];
            if (hasSmall) sizes.push(`S: ₹${item.small_price}`);
            if (hasMedium) sizes.push(`M: ₹${item.medium_price}`);
            if (hasLarge) sizes.push(`L: ₹${item.large_price}`);
            return (
                <div className="text-right">
                    <span className="font-bold text-green-600 text-sm">{sizes.join(' | ')}</span>
                </div>
            );
        }
        return <span className="font-bold text-green-600">₹{item.price}</span>;
    };

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
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

const VendorDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);

    // New Review State
    const [newRating, setNewRating] = useState(5);
    const [newReviewText, setNewReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [menuItems, setMenuItems] = useState<MenuItem[] | null>(null);

    // Initial image index reset when modal opens
    useEffect(() => {
        if (showMenuModal) setCurrentImageIndex(0);
    }, [showMenuModal]);

    // Fetch menu items for list view
    useEffect(() => {
        if (showListModal && id && menuItems === null) {
            api.vendors.getMenuItems(id).then(res => {
                if (res.success && res.data) {
                    setMenuItems(res.data);
                } else {
                    setMenuItems([]);
                }
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
            setReviews([res.data, ...reviews]); // Prepend new review
            setNewReviewText('');
            // Update average locally for immediate feedback
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
            // Recalculate average locally
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
                await navigator.share({
                    title: `Food Hunt - ${vendor.name}`,
                    text: `Check out ${vendor.name} on Food Hunt!`,
                    url: window.location.href,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center dark:text-white">Loading Vendor Details...</div>;
    if (!vendor) return <div className="p-10 text-center dark:text-white">Vendor not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
            {/* Header Image Area */}
            <div className="relative h-64 md:h-80 w-full">
                <img src={vendor.menu_image_urls?.[0] || vendor.logo_url} alt={vendor.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40"></div>
                <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="max-w-7xl mx-auto">
                        <Link to="/vendors" className="text-white/80 hover:text-white flex items-center gap-1 text-sm mb-2"><ChevronLeft size={16} /> Back to List</Link>
                        <button
                            onClick={handleShare}
                            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
                            title="Share"
                        >
                            <Share2 size={24} />
                        </button>
                        <div className="flex items-center gap-4 mb-2">
                            {vendor.logo_url && (
                                <img src={vendor.logo_url} alt="Logo" className="w-16 h-16 rounded-full border-2 border-white shadow-lg object-cover" />
                            )}
                            <h1 className="text-3xl md:text-5xl font-bold text-white">{vendor.name}</h1>
                        </div>
                        <div className="flex flex-wrap gap-4 text-white/90 text-sm font-medium">
                            <span className="flex items-center gap-1"><MapPin size={16} /> {vendor.location}</span>
                            {vendor.contact_number && (
                                <span className="flex items-center gap-1"><Phone size={16} /> {vendor.contact_number}</span>
                            )}
                            <span className="flex items-center gap-1"><Flame size={16} /> Rush: <span className="uppercase">{vendor.rush_level}</span></span>
                            <span className="flex items-center gap-1"><BarChart size={16} /> Popularity: {vendor.popularity_score}%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-8">

                {/* Left: Details & Menu Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-4 rounded-xl border dark:border-gray-700 text-center shadow-sm">
                            <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Cuisine</div>
                            <div className="font-bold dark:text-white">{vendor.cuisine}</div>
                            <div className="text-xs text-primary-500">{vendor.origin_tag}</div>
                        </div>
                        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-4 rounded-xl border dark:border-gray-700 text-center shadow-sm">
                            <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Min Price</div>
                            <div className="font-bold text-green-600 text-xl">₹{vendor.lowest_item_price}</div>
                        </div>
                        <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-4 rounded-xl border dark:border-gray-700 text-center shadow-sm">
                            <div className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Avg Meal</div>
                            <div className="font-bold text-gray-900 dark:text-white text-xl">₹{vendor.avg_price_per_meal}</div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm">
                        <h2 className="text-xl font-bold mb-3 dark:text-white">About</h2>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{vendor.description}</p>
                    </div>

                    {/* Menu Section (Restored + Button) */}
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2"><DollarSign size={20} /> Menu Highlights</h2>
                            <button
                                onClick={() => setShowListModal(true)}
                                className="text-sm bg-primary-100 hover:bg-primary-200 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                            >
                                <Eye size={14} /> View Menu List
                            </button>
                        </div>

                        {/* Menu Preview Card */}
                        <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 relative group cursor-pointer border dark:border-gray-700" onClick={() => setShowMenuModal(true)}>
                            {vendor.menu_image_urls && vendor.menu_image_urls.length > 0 ? (
                                <>
                                    <img
                                        src={vendor.menu_image_urls[0]}
                                        alt="Menu Preview"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <span className="bg-white/90 text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-all text-sm">
                                            {vendor.menu_image_urls.length > 1 ? `View Full Menu images (${vendor.menu_image_urls.length} pages)` : 'View Full Menu images'}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-lg backdrop-blur-sm pointer-events-none">
                                        <Eye size={14} />
                                        Menu Preview
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    No menu images available
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex justify-between">
                                <span>Lowest Item: <b>₹{vendor.lowest_item_price}</b></span>
                                <span>Average Meal: <b>₹{vendor.avg_price_per_meal}</b></span>
                            </div>
                            {vendor.recommended_item_name && (
                                <div className="pt-3 border-t dark:border-gray-700 text-center">
                                    <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center gap-2 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                                        <Star size={16} className="fill-current" /> Recommended: {vendor.recommended_item_name} <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(₹{vendor.recommended_item_price})</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Reviews */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-white to-orange-50/50 dark:bg-none dark:bg-dark-800 p-6 rounded-xl border dark:border-gray-700 shadow-sm sticky top-24">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold dark:text-white">Reviews</h3>
                            <div className="flex items-center gap-1 text-yellow-500 font-bold text-lg">
                                <Star className="fill-current" /> {vendor.rating_avg} <span className="text-gray-400 text-sm font-normal">({vendor.rating_count})</span>
                            </div>
                        </div>

                        {/* Add Review Form */}
                        {user ? (
                            <form onSubmit={handleSubmitReview} className="mb-8 pb-6 border-b dark:border-gray-700">
                                <h4 className="text-sm font-bold mb-2 dark:text-white">Write a Review</h4>
                                <div className="flex gap-2 mb-3">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <button key={num} type="button" onClick={() => setNewRating(num)} className={`${num <= newRating ? 'text-yellow-400' : 'text-gray-300'} transition-colors`}>
                                            <Star className="fill-current" size={24} />
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    required
                                    value={newReviewText}
                                    onChange={e => setNewReviewText(e.target.value)}
                                    placeholder="How was the food?"
                                    className="w-full p-3 rounded-lg border dark:border-gray-600 dark:bg-dark-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 mb-2"
                                    rows={3}
                                />
                                <button type="submit" disabled={submitting} className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 flex justify-center items-center gap-2">
                                    {submitting ? 'Posting...' : <><Send size={16} /> Post Review</>}
                                </button>
                            </form>
                        ) : (
                            <div className="bg-gray-50 dark:bg-dark-900 p-4 rounded-lg text-center text-sm text-gray-500 mb-6">
                                <Link to="/login" className="text-primary-600 font-bold hover:underline">Log in</Link> to write a review.
                            </div>
                        )}

                        {/* Reviews List */}
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {reviews.length === 0 ? (
                                <p className="text-center text-gray-400 italic">No reviews yet.</p>
                            ) : (
                                reviews.map(r => (
                                    <div key={r.id} className="pb-4 border-b dark:border-gray-700 last:border-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">{r.user_name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                                                {user?.role === 'admin' && (
                                                    <button onClick={() => handleDeleteReview(r.id)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 size={14} />
                                                    </button>
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

            {/* Full Screen Menu Modal (Image Preview) */}
            {showMenuModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setShowMenuModal(false)}>
                    <button onClick={() => setShowMenuModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white z-50">
                        <X size={32} />
                    </button>

                    <div className="relative max-w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={vendor.menu_image_urls?.[currentImageIndex]}
                            alt={`Menu Page ${currentImageIndex + 1}`}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />

                        {vendor.menu_image_urls && vendor.menu_image_urls.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(prev => prev > 0 ? prev - 1 : (vendor.menu_image_urls?.length || 1) - 1);
                                    }}
                                    className="absolute left-[-50px] top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <ChevronLeft size={32} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentImageIndex(prev => prev < (vendor.menu_image_urls?.length || 1) - 1 ? prev + 1 : 0);
                                    }}
                                    className="absolute right-[-50px] top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <ChevronLeft size={32} className="rotate-180" />
                                </button>

                                <div className="mt-4 flex gap-2 justify-center">
                                    {vendor.menu_image_urls.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                                        />
                                    ))}
                                </div>
                                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                                    {currentImageIndex + 1} / {vendor.menu_image_urls.length}
                                </div>
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
                            <button onClick={() => setShowListModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            {menuItems === null ? (
                                <p className="text-center text-gray-500 py-8">Loading menu items...</p>
                            ) : menuItems.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No menu listed</p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Group items by category */}
                                    {(() => {
                                        const grouped = menuItems.reduce((acc, item) => {
                                            const cat = item.category || 'General';
                                            if (!acc[cat]) acc[cat] = [];
                                            acc[cat].push(item);
                                            return acc;
                                        }, {} as Record<string, MenuItem[]>);

                                        return Object.entries(grouped).map(([category, items]) => (
                                            <div key={category}>
                                                <CategorySection title={category} items={items} />
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            )}
        </div >
    );
};

export default VendorDetail;
