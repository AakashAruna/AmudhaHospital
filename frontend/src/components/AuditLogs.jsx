import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Calendar, 
  UserRound, 
  AlertOctagon, 
  PackageCheck,
  CreditCard,
  Settings,
  Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const AuditLogs = () => {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/audit');
      setLogs(data);
    } catch (err) {
      setError(err.message || 'Failed to load audit trail logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action) => {
    switch (action) {
      case 'INVENTORY_OVERRIDE':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-red-150 animate-pulse">
            <AlertOctagon className="w-3 h-3" />
            Stock Override
          </span>
        );
      case 'DISPENSE_ITEM':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-150">
            <PackageCheck className="w-3 h-3" />
            Item Dispensed
          </span>
        );
      case 'PAYMENT_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-150">
            <CreditCard className="w-3 h-3" />
            Payment Recv
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
            <Settings className="w-3 h-3" />
            {action}
          </span>
        );
    }
  };

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(search.toLowerCase()) || 
    log.action_type.toLowerCase().includes(search.toLowerCase()) ||
    log.performed_by.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = [
      { key: 'id', label: 'Log ID' },
      { key: 'action_type', label: 'Action Classification' },
      { key: 'description', label: 'Detailed Description' },
      { key: 'performed_by', label: 'Performed By' },
      { key: 'timestamp', label: 'Logged Date' }
    ];
    exportToCSV(filteredLogs, headers, 'hms_audit_logs');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Trails</h1>
        <p className="text-slate-500 text-sm mt-1">Enterprise tamper-proof log of manual overrides, payments, and system initializations.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchLogs} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Filter and Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search audit trail logs by action description, type, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition"
            />
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition active:scale-95 duration-100"
            title="Export to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm">
              No audit logs recorded in CareFlow history.
            </div>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6 w-48">Action Classification</th>
                    <th className="py-4 px-6">Detailed Description</th>
                    <th className="py-4 px-6 w-36">Performed By</th>
                    <th className="py-4 px-6 w-48">Logged Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 whitespace-nowrap">
                        {getActionBadge(log.action_type)}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-900 leading-normal">
                        {log.description}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/50 px-2 py-0.5 rounded text-xs text-slate-600 font-bold">
                          <UserRound className="w-3.5 h-3.5" />
                          {log.performed_by}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100 bg-white">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition animate-fadeIn">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-shrink-0">
                      {getActionBadge(log.action_type)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">ID: {log.id.substring(0, 8)}...</span>
                  </div>

                  <p className="text-slate-800 text-sm font-medium leading-relaxed">
                    {log.description}
                  </p>

                  <div className="flex justify-between items-center pt-2 text-xs border-t border-slate-50">
                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded text-xs text-slate-600 font-bold">
                      <UserRound className="w-3.5 h-3.5" />
                      {log.performed_by}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Calendar className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
