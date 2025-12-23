
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { signup, signInWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    semester: '',
    password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Frontend Validation
    // Email validation is handled by input type="email" basic check, can add regex if strictly needed but firebase handles it too.
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const res = await signup(formData);
    setLoading(false);

    if (res.success) {
      navigate('/');
    } else {
      // Check if email already exists - silently redirect to login with email pre-filled
      if (res.message && res.message.toLowerCase().includes('already registered')) {
        navigate('/login', { state: { email: formData.email } });
      } else {
        setError(res.message);
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-dark-800 p-8 rounded-2xl shadow-lg border dark:border-gray-700">
        <h2 className="text-3xl font-bold mb-2 text-center text-gray-900 dark:text-white">Create Account</h2>
        <p className="text-center text-gray-500 mb-6">Join the food hunt today!</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
            <input
              name="email" type="email" required
              className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="you@example.com"
              value={formData.email} onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input
              name="name" type="text" required
              className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="Jane Doe"
              value={formData.name} onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
            <select
              name="semester" required
              className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              value={formData.semester} onChange={handleChange}
            >
              <option value="">Select Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              name="password" type="password" required
              className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              value={formData.password} onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
            <input
              name="confirm_password" type="password" required
              className="w-full p-3 border rounded-lg dark:bg-dark-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              value={formData.confirm_password} onChange={handleChange}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              required
              id="terms"
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-400">
              I agree to the <Link to="/terms" className="text-primary-600 hover:underline">Terms & Conditions</Link>
            </label>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={async () => {
              setError('');
              const res = await signInWithGoogle();
              // OAuth redirects to Google - user won't see this callback
              // On redirect back, onAuthStateChange handles the session
              // If profile doesn't exist, needsCompletion triggers /complete-profile redirect
              if (!res.success) {
                setError(res.message);
              }
              // If success, browser is redirecting to Google...
            }}
            className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 py-3 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </button>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-500">Already have an account? </span>
          <Link to="/login" className="text-primary-600 font-bold hover:underline">Log In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
