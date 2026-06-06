import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  CreditCard, 
  Coins, 
  Smartphone, 
  Search, 
  CheckCircle2,
  Calendar,
  UserRound,
  Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const Payments = () => {
  const { apiFetch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('http://localhost:8000/api/payments/transactions');
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Failed to load payments ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'Cash':
        return <Coins className="w-4 h-4 text-amber-500" />;
      case 'Card':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'UPI':
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-500" />;
    }
  };

  // Aggregated summaries
  const totalCollected = transactions.reduce((sum, tx) => sum + Number(tx.amount_paid), 0);
  const modeBreakdown = transactions.reduce((acc, tx) => {
    acc[tx.payment_mode] = (acc[tx.payment_mode] || 0) + Number(tx.amount_paid);
    return acc;
  }, {});

  const filteredTransactions = transactions.filter(tx => 
    tx.invoice_id.toLowerCase().includes(search.toLowerCase()) || 
    (tx.reference_number && tx.reference_number.toLowerCase().includes(search.toLowerCase())) ||
    tx.processed_by.toLowerCase().includes(search.toLowerCase()) ||
    (tx.invoice?.patient?.name && tx.invoice.patient.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExportCSV = () => {
    const headers = [
      { key: 'id', label: 'Transaction ID' },
      { key: 'invoice_id', label: 'Invoice ID' },
      { key: 'patient_name', label: 'Patient Name' },
      { key: 'amount_paid', label: 'Settled Amount' },
      { key: 'payment_mode', label: 'Payment Mode' },
      { key: 'reference_number', label: 'Reference Number' },
      { key: 'processed_by', label: 'Processed By' },
      { key: 'timestamp', label: 'Timestamp' }
    ];
    const exportData = filteredTransactions.map(tx => ({
      ...tx,
      patient_name: tx.invoice?.patient?.name || 'N/A'
    }));
    exportToCSV(exportData, headers, 'hms_payments');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments Ledger</h1>
        <p className="text-slate-500 text-sm mt-1">Audit trail of receipts, checkout transactions, and cashier signatures.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchTransactions} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Aggregate breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Ledger Volume</span>
          <p className="text-2xl font-extrabold text-slate-950 mt-1">₹{totalCollected.toFixed(2)}</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-500" />
            <span>Cash Receipts</span>
          </span>
          <p className="text-xl font-bold text-slate-950 mt-1">₹{(modeBreakdown['Cash'] || 0).toFixed(2)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Physical cash logs</span>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span>Card Settlements</span>
          </span>
          <p className="text-xl font-bold text-slate-950 mt-1">₹{(modeBreakdown['Card'] || 0).toFixed(2)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Visa, MasterCard settlements</span>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>UPI/QR Payments</span>
          </span>
          <p className="text-xl font-bold text-slate-950 mt-1">₹{(modeBreakdown['UPI'] || 0).toFixed(2)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Instant mobile checks</span>
        </div>
      </div>

      {/* Filter and Ledger Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search payments by invoice ID, transaction reference, or cashier name..."
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

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm">
              No transactions recorded in ledger logs.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                      <th className="py-4 px-6">Transaction ID</th>
                      <th className="py-4 px-6">Invoice ID</th>
                      <th className="py-4 px-6">Patient Name</th>
                      <th className="py-4 px-6">Settled Amount</th>
                      <th className="py-4 px-6">Mode</th>
                      <th className="py-4 px-6">Reference ID</th>
                      <th className="py-4 px-6">Processed By</th>
                      <th className="py-4 px-6">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-mono text-xs text-slate-400 truncate max-w-[120px]">{tx.id}</td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500 truncate max-w-[120px]">{tx.invoice_id}</td>
                        <td className="py-4 px-6 font-semibold text-slate-900">{tx.invoice?.patient?.name || 'N/A'}</td>
                        <td className="py-4 px-6 font-bold text-emerald-600">₹{Number(tx.amount_paid).toFixed(2)}</td>
                        <td className="py-4 px-6">
                          <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            {getPaymentModeIcon(tx.payment_mode)}
                            <span>{tx.payment_mode}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-slate-500">
                          {tx.reference_number || 'N/A'}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-600 font-medium">
                            <UserRound className="w-3.5 h-3.5" />
                            {tx.processed_by}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(tx.timestamp).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden divide-y divide-slate-100 bg-white">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400">TX: {tx.id.substring(0, 8)}...</span>
                        <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{tx.invoice?.patient?.name || 'N/A'}</h4>
                      </div>
                      <span className="text-emerald-600 text-sm font-extrabold">₹{Number(tx.amount_paid).toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Invoice ID</span>
                        <span className="font-mono text-slate-500">{tx.invoice_id.substring(0, 8)}...</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Payment Mode</span>
                        <span className="flex items-center gap-1.5 text-slate-700 font-semibold mt-0.5">
                          {getPaymentModeIcon(tx.payment_mode)}
                          <span>{tx.payment_mode}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Ref ID</span>
                        <span className="font-mono text-slate-600">{tx.reference_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Cashier</span>
                        <span className="font-medium text-slate-700">{tx.processed_by}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 text-xs text-slate-400 border-t border-slate-50">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(tx.timestamp).toLocaleString()}
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
