import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  CreditCard, 
  History, 
  LogOut, 
  UserRound,
  Calendar,
  Users,
  X
} from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab, onEditProfile, isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'billing', label: 'Billing Engine', icon: Receipt },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'attendance', label: 'Staff Management', icon: Users },
    { id: 'patients', label: 'Patient History', icon: UserRound },
    { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
    { id: 'audit', label: 'Audit Logs', icon: History },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.id === 'dashboard' || item.id === 'attendance') {
      return user?.role === 'Admin';
    }
    return true;
  });

  // Helper for role pill styling
  const getRoleStyle = (role) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-150 text-purple-800 border-purple-200';
      case 'Pharmacist':
        return 'bg-blue-150 text-blue-800 border-blue-200';
      default:
        return 'bg-emerald-150 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <>
      {/* Mobile Sidebar backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed lg:sticky inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen transition-transform duration-300 ease-in-out lg:translate-x-0 flex-shrink-0 text-slate-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col">
          {/* Logo and Brand */}
          <div className="h-24 flex items-center justify-between px-6 border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <img src="/logo.png" alt="Amudha Hospital" className="w-12 h-12 object-contain rounded-lg shadow-lg border border-slate-800" />
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-wide text-white uppercase leading-tight">
                  Amudha
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5 leading-none">
                  Hospital
                </span>
              </div>
            </div>
            
            {/* Mobile close button */}
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="mt-6 px-4 space-y-1">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 font-semibold'
                      : 'hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

      {/* User and Logout */}
      <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
        {user && (
          <button
            type="button"
            onClick={onEditProfile}
            className="w-full flex items-center gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800 hover:bg-slate-850 hover:border-slate-700 transition cursor-pointer text-left focus:outline-none group/user"
            title="Click to edit profile"
          >
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 group-hover/user:border-emerald-500/50 transition">
              <UserRound className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate group-hover/user:text-emerald-400 transition">{user.full_name}</p>
              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${getRoleStyle(user.role)}`}>
                {user.role}
              </span>
            </div>
          </button>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-800 text-sm font-semibold hover:bg-red-950/20 hover:text-red-400 hover:border-red-500/20 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
    </>
  );
};
