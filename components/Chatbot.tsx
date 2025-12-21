
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { generateBotResponse } from '../services/geminiService';
import { api } from '../services/mockDatabase';
import { Link, useLocation } from 'react-router-dom'; // Import Link and useLocation
import { Vendor } from '../types'; // Import Vendor

const Chatbot: React.FC = () => {
    const location = useLocation();

    // Hide chatbot on admin pages
    const isAdminPage = location.pathname.startsWith('/admin');
    if (isAdminPage) {
        return null;
    }
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
        { role: 'bot', text: 'Hey! Hungry? Ask me about cheap food, healthy options, or where to find pizza!' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]); // Store vendors
    const scrollRef = useRef<HTMLDivElement>(null);

    // State to track if floating action bar is visible (for mobile positioning)
    const [floatingBarVisible, setFloatingBarVisible] = useState(false);

    // Listen for floating bar visibility changes from VendorDetail page
    useEffect(() => {
        const checkFloatingBar = () => {
            setFloatingBarVisible(document.body.hasAttribute('data-floating-bar'));
        };

        // Initial check
        checkFloatingBar();

        // Use MutationObserver to detect attribute changes on body
        const observer = new MutationObserver(checkFloatingBar);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-floating-bar'] });

        return () => observer.disconnect();
    }, []);

    // Fetch vendors on mount for linking logic
    useEffect(() => {
        const fetchVendors = async () => {
            const res = await api.vendors.getAll();
            if (res.success && res.data) {
                setVendors(res.data);
            }
        };
        fetchVendors();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            // Get context for the bot safely
            let context = '';
            try {
                // Fetch ALL context data in parallel
                const [vendorsRes, menusRes, reviewsRes, splitsRes] = await Promise.all([
                    api.vendors.getAll(),
                    api.menus.getAll(),
                    api.reviews.getRecent(15),
                    api.splits.getAll()
                ]);

                let contextObj = {
                    vendors: [] as any[],
                    menu_items: [] as any[],
                    recent_reviews: [] as any[],
                    active_splits: [] as any[]
                };

                if (vendorsRes.success && vendorsRes.data) {
                    contextObj.vendors = vendorsRes.data.map(v => ({
                        id: v.id,
                        name: v.name,
                        cuisine: v.cuisine,
                        location: v.location,
                        price: v.avg_price_per_meal,
                        popular_item: v.recommended_item_name
                    }));
                }

                if (menusRes.success && menusRes.data) {
                    // Group menus by vendor for efficiency is implied by providing vendor_id
                    // But to save tokens, we might just list popular ones or list with vendor_id
                    // Let's list simplified items:
                    contextObj.menu_items = menusRes.data.map(m => ({
                        vendor_id: m.vendor_id,
                        name: m.name,
                        price: m.price,
                        recommended: m.is_recommended
                    }));
                }

                if (reviewsRes.success && reviewsRes.data) {
                    contextObj.recent_reviews = reviewsRes.data.map(r => ({
                        vendor_id: r.vendor_id,
                        rating: r.rating,
                        text: r.review_text.substring(0, 100) // Truncate
                    }));
                }

                if (splitsRes.success && splitsRes.data) {
                    contextObj.active_splits = splitsRes.data.map(s => ({
                        vendor: s.vendor_name,
                        dish: s.dish_name,
                        time: s.split_time,
                        needed: s.people_needed - (s.people_joined_ids?.length || 0)
                    }));
                }

                context = JSON.stringify(contextObj);
            } catch (err) {
                console.error("Error fetching context:", err);
            }

            const reply = await generateBotResponse(userMsg, context);

            if (!reply) throw new Error("Empty response");

            // Helper to strip markdown (safely)
            const cleanMarkdown = (text: string) => {
                if (typeof text !== 'string') return '';
                return text
                    .replace(/[*_#`]/g, '')          // Remove all markdown symbols
                    .replace(/\n\s*-\s/g, '\n\u2022 ') // Replace dash lists
                    .trim();
            };

            setMessages(prev => [...prev, { role: 'bot', text: cleanMarkdown(reply) }]);
        } catch (error) {
            console.error("Chatbot Error:", error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having a bit of trouble connecting right now. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    // Helper to renderer text with clickable vendor links
    const renderMessageWithLinks = (text: string, role: string) => {
        if (role === 'user') return text;

        // Find known vendor names
        // Sort by length desc to match "Burger King" before "Burger"
        const sortedVendors = [...vendors].sort((a, b) => b.name.length - a.name.length);

        // Create a regex pattern
        // Escape special regex chars in names if any
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(${sortedVendors.map(v => escapeRegExp(v.name)).join('|')})`, 'gi');

        const parts = text.split(pattern);

        return parts.map((part, i) => {
            const vendor = vendors.find(v => v.name.toLowerCase() === part.toLowerCase());
            if (vendor) {
                return (
                    <Link
                        key={i}
                        to={`/vendors/${vendor.id}`}
                        className="font-bold underline text-primary-600 dark:text-primary-400 hover:text-primary-800"
                    >
                        {part}
                    </Link>
                );
            }
            return part;
        });
    };

    return (
        <div className={`fixed right-6 z-50 transition-all duration-300 ${floatingBarVisible ? 'bottom-24' : 'bottom-6'}`}>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105"
                >
                    <MessageCircle size={28} />
                </button>
            )}

            {isOpen && (
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-2xl w-80 sm:w-96 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 h-[500px] animate-fade-in-up">
                    <div className="bg-primary-600 p-4 flex justify-between items-center text-white">
                        <h3 className="font-bold flex items-center gap-2"><MessageCircle size={18} /> FoodieBot</h3>
                        <button onClick={() => setIsOpen(false)}><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar" ref={scrollRef}>
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-600'}`}>
                                    {renderMessageWithLinks(m.text, m.role)}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-bl-none text-xs text-gray-500 dark:text-gray-400 italic flex gap-1 items-center">
                                    <span className="animate-bounce">●</span>
                                    <span className="animate-bounce delay-100">●</span>
                                    <span className="animate-bounce delay-200">●</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t dark:border-gray-700 flex gap-2 bg-gray-50 dark:bg-gray-900">
                        <input
                            className="flex-1 border dark:border-gray-600 bg-white dark:bg-dark-800 dark:text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                            placeholder="Ask about food..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            className={`p-2 rounded-full transition-colors ${input.trim() ? 'text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800' : 'text-gray-400 cursor-not-allowed'}`}
                            disabled={!input.trim()}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chatbot;