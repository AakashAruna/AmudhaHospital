import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Appointments } from './components/Appointments';
import { Patients } from './components/Patients';
import { Inventory } from './components/Inventory';
import { Billing } from './components/Billing';
import { Payments } from './components/Payments';
import { AuditLogs } from './components/AuditLogs';
import { Attendance } from './components/Attendance';
import { useWebSocket } from './hooks/useWebSocket';
import { AlertTriangle, CheckCircle, Info, X, Sparkles, Lock, Menu, UserRound } from 'lucide-react';

const MainAppContent = () => {
  const { isAuthenticated, loading, user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toasts, setToasts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Redirect non-admins away from dashboard on login or tab selection
  useEffect(() => {
    if (user && user.role !== 'Admin' && activeTab === 'dashboard') {
      setActiveTab('appointments');
    }
  }, [user, activeTab]);

  // Profile Edit Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [profileError, setProfileError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Pre-fill name when modal opens
  useEffect(() => {
    if (user) {
      setEditName(user.full_name);
    }
  }, [isProfileOpen, user]);

  // Function to push a toast
  const addToast = (type, message, detail) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, type, message, detail };
    setToasts(prev => [newToast, ...prev]);
    
    // Automatically clear after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Connect to WebSocket and trigger toasts on alerts
  useWebSocket((message) => {
    if (message.type === 'LOW_STOCK_ALERT') {
      addToast(
        'low_stock',
        `Low Stock Alert: ${message.item_name}`,
        `Current stock is ${message.current_stock} (Reorder level is ${message.reorder_level}).`
      );
    } else if (message.type === 'PAYMENT_ALERT') {
      addToast(
        'payment',
        `Payment Processed Successfully`,
        `Invoice ${message.invoice_id.substring(0, 8)}... received ₹${message.amount_paid.toFixed(2)}. Status: ${message.status}`
      );
    }
  });

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editName) return;

    if (editPassword && editPassword !== editConfirm) {
      setProfileError('Passwords do not match');
      return;
    }

    setProfileError(null);
    setProfileLoading(true);
    try {
      await updateProfile(editName, editPassword || undefined);
      addToast('success', 'Profile Updated Successfully', 'Your name and settings have been saved.');
      setIsProfileOpen(false);
      
      // Clear password fields
      setEditPassword('');
      setEditConfirm('');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile settings.');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Render view corresponding to selected tab
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return user?.role === 'Admin' ? <Dashboard /> : <Appointments />;
      case 'appointments':
        return <Appointments />;
      case 'patients':
        return <Patients />;
      case 'inventory':
        return <Inventory />;
      case 'billing':
        return <Billing />;
      case 'payments':
        return <Payments />;
      case 'attendance':
        return <Attendance />;
      case 'audit':
        return <AuditLogs />;
      default:
        return user?.role === 'Admin' ? <Dashboard /> : <Appointments />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 text-slate-300 no-print flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition active:scale-95"
            title="Toggle Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Amudha Hospital" className="w-8 h-8 object-contain rounded-md" />
            <span className="text-sm font-black tracking-wide text-white uppercase">Amudha Hospital</span>
          </div>
        </div>
        {user && (
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-350 border border-slate-700 hover:border-emerald-500 transition active:scale-95"
            title="Edit Profile"
          >
            <UserRound className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onEditProfile={() => setIsProfileOpen(true)} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main viewport */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-full lg:max-w-[1400px] mx-auto w-full min-w-0">
        {renderView()}
      </main>

      {/* Profile Edit Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn no-print">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <span>Edit Profile Settings</span>
              </h3>
              <button 
                onClick={() => {
                  setProfileError(null);
                  setIsProfileOpen(false);
                }} 
                className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4 text-sm">
              {profileError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your full display name"
                />
              </div>

              <div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-150" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="px-2 bg-white text-slate-400 font-bold tracking-wider">
                      Reset Password (Optional)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="pl-10 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter new password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="password"
                    value={editConfirm}
                    onChange={(e) => setEditConfirm(e.target.value)}
                    className="pl-10 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setProfileError(null);
                    setIsProfileOpen(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {profileLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Deck */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border animate-slideIn ${
              toast.type === 'low_stock' 
                ? 'bg-red-50 text-red-900 border-red-200' 
                : toast.type === 'payment' || toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-250'
                : 'bg-slate-900 text-white border-slate-850'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'low_stock' ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : toast.type === 'payment' || toast.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <Info className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold font-sans uppercase tracking-wider">
                {toast.type === 'low_stock' ? 'Low Stock Warning' : toast.type === 'payment' ? 'Ledger Activity' : toast.type === 'success' ? 'Task Complete' : 'System Message'}
              </h4>
              <p className="text-sm font-semibold mt-1 leading-snug">{toast.message}</p>
              {toast.detail && <p className="text-xs text-slate-500 mt-0.5 leading-normal">{toast.detail}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-200/50 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
};

export default App;
