import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Github, Linkedin, Instagram } from 'lucide-react';
import { api } from '../services/mockDatabase';

const MegaFooter: React.FC = () => {
    const navigate = useNavigate();

    const handleHelpCenter = async () => {
        // Search for admin account by UID and navigate to inbox
        const res = await api.users.search('170467');
        if (res.success && res.data) {
            navigate(`/inbox?userId=${res.data.id}&userName=${encodeURIComponent(res.data.name || 'Food-Hunt Team')}`);
        } else {
            // Fallback to hardcoded email if UID lookup fails
            navigate('/inbox?userId=foodhunt101lpu@gmail.com&userName=Food-Hunt%20Team');
        }
    };

    return (
        <footer className="bg-slate-950 text-gray-300">
            {/* Main Footer Content */}
            <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-12">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white">
                            Food-Hunt
                        </h2>
                        <p className="text-gray-400 text-sm">Find Food. Find Friends.</p>
                        <div className="flex items-center gap-4 pt-2">
                            <a
                                href="https://github.com/justkalesh"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full bg-slate-800 hover:bg-primary-600 transition-colors duration-200"
                                aria-label="GitHub"
                            >
                                <Github size={20} className="text-gray-300 hover:text-white" />
                            </a>
                            <a
                                href="https://www.linkedin.com/in/justkalesh/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full bg-slate-800 hover:bg-primary-600 transition-colors duration-200"
                                aria-label="LinkedIn"
                            >
                                <Linkedin size={20} className="text-gray-300 hover:text-white" />
                            </a>
                            <a
                                href="https://www.instagram.com/kalash.hu/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-full bg-slate-800 hover:bg-primary-600 transition-colors duration-200"
                                aria-label="Instagram"
                            >
                                <Instagram size={20} className="text-gray-300 hover:text-white" />
                            </a>
                        </div>
                    </div>

                    {/* Product Column */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Product</h3>
                        <ul className="space-y-3">
                            <li>
                                <Link
                                    to="#features"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Features
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/vendors"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Vendor Lists
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/splits"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Meal Splits
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/vendors?hiddenGems=true"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Hidden Gems
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support & Info Column (merged Legal & Support with About Us) */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Support & Info</h3>
                        <ul className="space-y-3">
                            <li>
                                <button
                                    onClick={handleHelpCenter}
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm text-left"
                                >
                                    Help Center
                                </button>
                            </li>
                            <li>
                                <Link
                                    to="/about"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/privacy"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/terms"
                                    className="text-gray-400 hover:text-primary-500 transition-colors duration-200 text-sm"
                                >
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Copyright Bar */}
            <div className="border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <p className="text-center text-gray-500 text-sm">
                        © 2026 Food-Hunt. Built for LPU.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default MegaFooter;
