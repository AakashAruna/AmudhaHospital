import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Sparkles } from 'lucide-react';

export const Login = () => {
  const { login, register } = useAuth();
  
  // Toggle registration
  const [isRegister, setIsRegister] = useState(false);
  
  // Input fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Billing Clerk');
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    if (isRegister && !fullName) return;

    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        // Register first
        await register(username, password, fullName, role);
        // Auto-login upon registration
        await login(username, password);
      } else {
        // Simple login
        await login(username, password);
      }
    } catch (err) {
      setError(err.message || 'Action failed. Please verify inputs.');
    } finally {
      setLoading(false);
    }
  };

  const selectDemoProfile = (user) => {
    setIsRegister(false);
    setUsername(user);
    setPassword('Password123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-950/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-slate-950/40 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex flex-col items-center justify-center gap-4">
          <img src="/logo.png" alt="Amudha Hospital" className="w-36 h-36 object-contain" />
          <span className="text-2xl font-black tracking-wider text-white font-sans uppercase text-center">
            Amudha <span className="text-emerald-400">Hospital</span>
          </span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          {isRegister ? 'Create an Account' : 'Sign in to HMS'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Enterprise Hospital Management System Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="glass-dark py-8 px-6 sm:px-10 rounded-2xl shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4 flex gap-3 text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {isRegister && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-300">
                  Full Name
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Sparkles className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-800/80 placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    placeholder="e.g. Dr. John Watson"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-800/80 placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="Enter username"
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Access Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full px-3.5 py-2.5 border border-slate-700 rounded-xl bg-slate-800/80 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                >
                  <option value="Billing Clerk">Billing Clerk (Payments & Billing)</option>
                  <option value="Pharmacist">Pharmacist (Inventory CRUD)</option>
                  <option value="Admin">Admin (Full System Access)</option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-800/80 placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  placeholder="Enter password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition duration-150 ease-in-out disabled:opacity-50"
              >
                {loading ? (isRegister ? 'Registering...' : 'Signing in...') : (isRegister ? 'Register Account' : 'Sign in')}
              </button>
            </div>
          </form>

          {/* Toggle link */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setError(null);
                setIsRegister(!isRegister);
              }}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              {isRegister ? 'Already have an account? Sign In' : 'Don\'t have an account? Create an Account'}
            </button>
          </div>

          {!isRegister && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-[#1b253b] text-slate-400 font-medium">
                    Select Demo User Profile
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <button
                  onClick={() => selectDemoProfile('admin')}
                  className="flex flex-col items-center justify-center py-2 px-2 border border-slate-700/60 rounded-xl bg-slate-800/40 hover:bg-emerald-950/20 hover:border-emerald-500/50 transition text-slate-300 hover:text-white"
                >
                  <span className="text-xs font-bold">Admin</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Full Access</span>
                </button>
                <button
                  onClick={() => selectDemoProfile('pharmacist')}
                  className="flex flex-col items-center justify-center py-2 px-2 border border-slate-700/60 rounded-xl bg-slate-800/40 hover:bg-emerald-950/20 hover:border-emerald-500/50 transition text-slate-300 hover:text-white"
                >
                  <span className="text-xs font-bold">Pharmacist</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Inventory</span>
                </button>
                <button
                  onClick={() => selectDemoProfile('clerk')}
                  className="flex flex-col items-center justify-center py-2 px-2 border border-slate-700/60 rounded-xl bg-slate-800/40 hover:bg-emerald-950/20 hover:border-emerald-500/50 transition text-slate-300 hover:text-white"
                >
                  <span className="text-xs font-bold">Clerk</span>
                  <span className="text-[9px] text-slate-500 mt-0.5">Billing</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
