
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/mockDatabase';
import { Vendor } from '../types';
import { Search, MapPin, Star, Flame, Phone, Filter, X, Sparkles } from 'lucide-react';
import { PageLoading } from '../components/ui/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const VendorList: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filtered, setFiltered] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Filter & Sort States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);

  // Derived Options
  const locations = Array.from(new Set(vendors.map(v => v.location))).filter((l): l is string => !!l);
  const origins = Array.from(new Set(vendors.map(v => v.origin_tag))).filter((o): o is string => !!o);

  const toggleSelection = (list: string[], item: string, setList: (l: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const clearFilters = () => {
    setSortBy('');
    setSelectedLocations([]);
    setSelectedOrigins([]);
    setSearch('');
  };

  useEffect(() => {
    const fetch = async () => {
      const res = await api.vendors.getAll();
      if (res.success && res.data) {
        const activeVendors = res.data.filter(v => v.is_active !== false);
        setVendors(activeVendors);
        setFiltered(activeVendors);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  useEffect(() => {
    let res = [...vendors];

    if (search) {
      const lower = search.toLowerCase();
      res = res.filter(v =>
        v.name.toLowerCase().includes(lower) ||
        v.cuisine.toLowerCase().includes(lower) ||
        v.origin_tag.toLowerCase().includes(lower)
      );
    }

    if (selectedLocations.length > 0) {
      res = res.filter(v => selectedLocations.includes(v.location));
    }

    if (selectedOrigins.length > 0) {
      res = res.filter(v => selectedOrigins.includes(v.origin_tag));
    }

    // Sorting
    if (sortBy === 'avg_asc') {
      res.sort((a, b) => a.avg_price_per_meal - b.avg_price_per_meal);
    } else if (sortBy === 'avg_desc') {
      res.sort((a, b) => b.avg_price_per_meal - a.avg_price_per_meal);
    } else if (sortBy === 'rating_high') {
      res.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    } else if (sortBy === 'rating_low') {
      res.sort((a, b) => (a.rating_avg || 0) - (b.rating_avg || 0));
    } else {
      // Default: Featured first
      res.sort((a, b) => {
        if (a.is_featured === b.is_featured) {
          return (a.sort_order || 999) - (b.sort_order || 999);
        }
        return a.is_featured ? -1 : 1;
      });
    }

    setFiltered(res);
  }, [search, vendors, sortBy, selectedLocations, selectedOrigins]);

  if (loading) return <PageLoading message="Loading campus vendors..." />;

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
            Discover Campus Eats
          </span>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
            Campus <span className="text-primary-600">Food Spots</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
            Explore every food vendor on campus. Filter by cuisine, price, and location.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search & Filter Bar */}
        <div className="glass dark:glass-dark rounded-2xl p-4 mb-8 shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Filter size={18} />
              <span className="text-sm font-medium">Search</span>
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by name, cuisine..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFilterOpen(true)}
              leftIcon={<Filter size={16} />}
              className="!bg-white dark:!bg-slate-700 border border-gray-200 dark:border-gray-500"
            >
              Filters
            </Button>

            {(search || selectedLocations.length > 0 || selectedOrigins.length > 0) && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Vendor Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vendor, idx) => (
            <Link
              to={`/vendors/${vendor.id}`}
              key={vendor.id}
              className="stagger-item group"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <Card variant="default" className="h-full overflow-hidden">
                {/* Gradient blob decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary-500/10 transition-all" />

                {/* Image Section */}
                <div className="h-44 -mx-6 -mt-6 mb-4 overflow-hidden relative">
                  <img
                    src={vendor.logo_url || vendor.menu_image_urls?.[0]}
                    alt={vendor.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                    {vendor.is_featured && (
                      <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1">
                        <Star size={12} className="fill-current" /> Featured
                      </span>
                    )}
                    <span className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1 text-gray-900 dark:text-white">
                      <Star size={12} className="text-yellow-400 fill-current" />
                      {vendor.rating_avg ? vendor.rating_avg.toFixed(1) : 'New'}
                    </span>
                  </div>

                  {/* Rush Level Badge */}
                  {vendor.rush_level === 'high' && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg flex items-center gap-1">
                      <Flame size={12} /> Busy Now
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Header Row */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors truncate">
                      {vendor.name}
                    </h3>
                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
                      <MapPin size={12} />
                      <span className="truncate">{vendor.location}</span>
                    </div>
                  </div>

                  {/* Price & Tags */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                        From
                      </span>
                      <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                        ₹{vendor.lowest_item_price}
                      </span>
                    </div>
                    <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {vendor.origin_tag}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                    {vendor.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Avg: <span className="font-semibold text-gray-700 dark:text-gray-200">₹{vendor.avg_price_per_meal}</span>
                    </span>
                    {vendor.contact_number && (
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        <Phone size={12} />
                        <span>{vendor.contact_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No vendors found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try a different search or clear your filters.</p>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass dark:glass-dark rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Filters</h3>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Sort Options */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Sort By</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Price: Low to High', value: 'avg_asc' },
                    { label: 'Price: High to Low', value: 'avg_desc' },
                    { label: 'Rating: High to Low', value: 'rating_high' },
                    { label: 'Rating: Low to High', value: 'rating_low' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="sort"
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                        checked={sortBy === option.value}
                        onChange={() => setSortBy(option.value)}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Food Courts</h4>
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => (
                    <button
                      key={loc}
                      onClick={() => toggleSelection(selectedLocations, loc, setSelectedLocations)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${selectedLocations.includes(loc)
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                        }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Origins */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Origin</h4>
                <div className="flex flex-wrap gap-2">
                  {origins.map(origin => (
                    <button
                      key={origin}
                      onClick={() => toggleSelection(selectedOrigins, origin, setSelectedOrigins)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${selectedOrigins.includes(origin)
                        ? 'bg-primary-100 dark:bg-primary-900/40 border-primary-500 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                        }`}
                    >
                      {origin}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex gap-3 rounded-b-2xl">
              <Button variant="ghost" className="flex-1" onClick={clearFilters}>
                Clear All
              </Button>
              <Button className="flex-1" onClick={() => setIsFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorList;
