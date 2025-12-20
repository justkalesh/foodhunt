import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Users, Star, Sparkles, Utensils, Award } from 'lucide-react';
import { Card } from '../components/ui/Card';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-white dark:bg-slate-950 overflow-hidden">
        {/* Gradient Blob Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-semibold mb-8 animate-fade-in">
              <Sparkles size={16} />
              <span>Campus Food Discovery Platform</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 animate-slide-up">
              Find <span className="text-primary-600">Food</span>.
              <br />
              Find <span className="text-primary-600">Friends</span>.
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              The ultimate campus companion. Discover hidden gems, split meals to save money, and never eat alone again.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/vendors"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary-600 text-white font-bold text-lg shadow-lg hover:shadow-primary-500/30 hover:-translate-y-1 transition-all duration-300"
              >
                <Search size={22} />
                Browse Food
              </Link>
              <Link
                to="/splits"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-bold text-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-300"
              >
                <Users size={22} />
                Find a Squad
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white dark:bg-slate-900 border-y border-gray-100 dark:border-slate-800 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: '10+', label: 'Campus Vendors', icon: Utensils },
              { value: '₹35-220', label: 'Meal Price Range', icon: Star },
              { value: 'Save 50%', label: 'By Splitting Meals', icon: Users },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="stagger-item text-center p-6"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                  <stat.icon size={24} />
                </div>
                <div className="text-4xl font-extrabold text-primary-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-500 dark:text-gray-400 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4">
          <Card variant="glass" padding="lg" hover={false} className="overflow-hidden">
            <div className="relative z-10">
              {/* Section Header */}
              <div className="text-center mb-12">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                  <Sparkles size={14} />
                  Getting Started
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  How It <span className="text-primary-600">Works</span>
                </h2>
              </div>

              {/* Steps Grid */}
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    num: 1,
                    title: 'Discover Vendors',
                    desc: 'Search every food spot on campus, filter by cuisine, price, and dietary needs.',
                    icon: Search,
                    color: 'bg-primary-500'
                  },
                  {
                    num: 2,
                    title: 'Split Meals',
                    desc: 'Want that family pizza but alone? Find people to share costs and make friends.',
                    icon: Users,
                    color: 'bg-accent-sky'
                  },
                  {
                    num: 3,
                    title: 'Earn Rewards',
                    desc: 'Rate food, upload photos, and join splits to earn Loyalty Points and badges.',
                    icon: Award,
                    color: 'bg-accent-lime'
                  },
                ].map((step) => (
                  <div key={step.num} className="text-center group">
                    <div
                      className={`w-20 h-20 mx-auto rounded-2xl ${step.color} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}
                    >
                      <step.icon size={32} />
                    </div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed px-4">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Background decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-sky/5 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent-lime rounded-full blur-3xl" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
            Ready to Find Your <span className="text-primary-200">Food Squad</span>?
          </h2>
          <p className="text-lg md:text-xl text-primary-100 max-w-2xl mx-auto mb-10">
            Join hundreds of students saving money and making friends over food.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-white text-primary-600 font-bold text-lg hover:bg-gray-100 transition-all transform hover:-translate-y-0.5 shadow-xl"
            >
              Get Started Free
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/vendors"
              className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-primary-800/50 backdrop-blur-sm text-white border border-primary-400/30 font-bold text-lg hover:bg-primary-800 transition-all"
            >
              <Search size={20} />
              Explore Vendors
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;