import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  User, 
  Phone, 
  Calendar, 
  FileText, 
  Activity, 
  CreditCard,
  ChevronDown,
  ChevronUp,
  Clock,
  Briefcase,
  HeartPulse,
  RefreshCw
} from 'lucide-react';

export const Patients = () => {
  const { apiFetch } = useAuth();
  
  // Patient list states
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  
  // Selected patient details states
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  
  // Accordion state for invoices
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [inventory, setInventory] = useState([]);

  // Fetch initial patient list
  const fetchPatientsList = async () => {
    setLoadingList(true);
    try {
      const data = await apiFetch('http://localhost:8000/api/billing/patients');
      setPatients(data);
    } catch (err) {
      console.error('Failed to fetch patient list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchInventoryList = async () => {
    try {
      const data = await apiFetch('http://localhost:8000/api/inventory');
      setInventory(data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  };

  useEffect(() => {
    fetchPatientsList();
    fetchInventoryList();
  }, []);

  // Fetch detailed medical history for selected patient
  const fetchPatientHistory = async (patientId) => {
    setSelectedPatientId(patientId);
    setLoadingHistory(true);
    setHistoryError(null);
    setExpandedInvoices({});
    try {
      const data = await apiFetch(`http://localhost:8000/api/billing/patients/${patientId}/history`);
      setHistoryData(data);
    } catch (err) {
      console.error('Failed to load patient history:', err);
      setHistoryError('Could not load patient medical history. Please try again.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Toggle invoice item list accordion
  const toggleInvoiceAccordion = (invoiceId) => {
    setExpandedInvoices(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

  // Filter patient directory by query
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.contact.includes(searchQuery)
  );

  // Compile unified timeline items (appointments and invoices sorted by date DESC)
  const getTimelineItems = () => {
    if (!historyData) return [];
    
    const items = [];
    
    // Add appointments
    (historyData.appointments || []).forEach(appt => {
      const apptDate = appt.appointment_date || new Date().toISOString().split('T')[0];
      items.push({
        id: `appt-${appt.id}`,
        type: 'appointment',
        date: apptDate,
        time: appt.appointment_time || '',
        rawDate: new Date(`${apptDate}T00:00:00`),
        data: appt
      });
    });

    // Add invoices
    (historyData.invoices || []).forEach(inv => {
      const createdAtStr = inv.created_at ? (typeof inv.created_at === 'string' ? inv.created_at : new Date(inv.created_at).toISOString()) : new Date().toISOString();
      const dateOnly = createdAtStr.split('T')[0];
      const timeStr = new Date(createdAtStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      items.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        date: dateOnly,
        time: timeStr,
        rawDate: new Date(createdAtStr),
        data: inv
      });
    });

    // Sort descending by date and time
    return items.sort((a, b) => b.rawDate - a.rawDate);
  };

  const timelineItems = getTimelineItems();

  // Calculate totals
  const totalBilled = historyData?.invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
  const totalVisits = historyData?.appointments?.length || 0;

  // Status Badge helper
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Completed':
      case 'Paid':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Cancelled':
      case 'Unpaid':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-140px)] animate-fadeIn">
      
      {/* LEFT COLUMN: Search & Patient List (Col span 4) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-[350px] lg:h-full">
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Patient Directory</h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs transition"
            />
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingList ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-20 text-slate-450 text-xs italic">
              No registered patients found.
            </div>
          ) : (
            filteredPatients.map(pat => {
              const isSelected = selectedPatientId === pat.id;
              return (
                <button
                  key={pat.id}
                  onClick={() => fetchPatientHistory(pat.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50/80 transition flex items-center justify-between ${
                    isSelected ? 'bg-emerald-50/40 border-r-4 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${
                      isSelected ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200/30' : 'bg-slate-50 text-slate-500 border-slate-100'
                    }`}>
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className={`font-semibold text-xs block ${
                        isSelected ? 'text-emerald-800' : 'text-slate-900'
                      }`}>
                        {pat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {pat.age} yrs • {pat.gender}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                      {pat.contact}
                    </span>
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded border mt-1 ${
                      pat.admission_status === 'Inpatient' 
                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                        : 'bg-slate-50 text-slate-650 border-slate-150'
                    }`}>
                      {pat.admission_status}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: History Timeline (Col span 8) */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden min-h-[400px] lg:h-full">
        {selectedPatientId === null ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm animate-pulse">
              <HeartPulse className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-4">Clinical History File</h3>
            <p className="text-slate-400 text-xs mt-1.5 max-w-sm">
              Select a patient from the left directory to view their complete check-up logs, consulting doctors, and treatment bill items.
            </p>
          </div>
        ) : loadingHistory ? (
          // Loading history
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : historyError ? (
          // Error State
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-red-500 font-bold mb-2">Error</div>
            <p className="text-slate-500 text-xs">{historyError}</p>
            <button
              onClick={() => fetchPatientHistory(selectedPatientId)}
              className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          // Active Patient File View
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* 1. Patient summary card */}
            <div className="p-5 border-b border-slate-100 bg-slate-550/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{historyData.patient.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-slate-500 text-xs mt-1 font-medium">
                  <span>{historyData.patient.age} years old</span>
                  <span className="text-slate-300">•</span>
                  <span>{historyData.patient.gender}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-mono flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {historyData.patient.contact}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => fetchPatientHistory(historyData.patient.id)}
                  disabled={loadingHistory}
                  className="p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mr-1"
                  title="Refresh Medical History"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                  historyData.patient.admission_status === 'Inpatient'
                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  <Activity className="w-3.5 h-3.5" />
                  {historyData.patient.admission_status}
                </span>
              </div>
            </div>

            {/* 2. KPI Statistics Row */}
            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50/40 border-b border-slate-100">
              <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-xs flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visits & Checkups</span>
                  <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{totalVisits}</span>
                </div>
              </div>
              
              <div className="bg-white border border-slate-150 p-4 rounded-xl shadow-xs flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Payout</span>
                  <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">₹{totalBilled.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 3. Timeline section */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
              <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest block mb-2">
                Unified Medical & Billing Timeline
              </h4>

              {timelineItems.length === 0 ? (
                <div className="text-center py-12 text-slate-450 text-xs italic bg-white border border-slate-150 rounded-xl">
                  No medical or transaction history logs found for this patient.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 pl-6 ml-3 space-y-8">
                  {timelineItems.map((item) => {
                    const isAppt = item.type === 'appointment';
                    const data = item.data;
                    
                    return (
                      <div key={item.id} className="relative">
                        {/* Circle badge on timeline thread */}
                        <span className={`absolute -left-[35px] top-1.5 flex items-center justify-center w-6.5 h-6.5 rounded-full border-2 bg-white ${
                          isAppt ? 'text-emerald-500 border-emerald-500/30 shadow-emerald-500/10' : 'text-blue-500 border-blue-500/30 shadow-blue-500/10'
                        } shadow-sm`}>
                          {isAppt ? <Activity className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </span>

                        {/* Content box */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4.5 hover:shadow-sm transition duration-150">
                          {/* Top metadata */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                {isAppt ? 'Doctor Consultation' : 'Prescription & Bill Summary'}
                              </span>
                              <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(data.status)}`}>
                                {data.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{item.date} • {item.time}</span>
                            </div>
                          </div>

                          {/* Body Details */}
                          <div className="mt-3 text-xs text-slate-600">
                            {isAppt ? (
                              /* APPOINTMENT BODY */
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Physician</span>
                                  <span className="font-semibold text-slate-800 block flex items-center gap-1">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    {data.doctor_name}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Queue Slot</span>
                                  <span className="font-semibold text-slate-800 block">Token #{data.queue_number || '-'}</span>
                                </div>
                                <div className="col-span-1 sm:col-span-2 space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason for visit / symptoms</span>
                                  <p className="text-slate-650 bg-slate-50 p-2.5 rounded-lg border border-slate-150/50 leading-relaxed italic">
                                    {data.reason || 'No specific symptoms logged.'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* INVOICE BODY */
                              <div className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-150/50">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-mono text-slate-400">Invoice ID: #{data.id.substring(0, 8)}...</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">Billed by: {data.billed_by || 'system'}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed</span>
                                    <span className="font-extrabold text-slate-900 text-sm">₹{Number(data.total_amount || 0).toFixed(2)}</span>
                                  </div>
                                </div>

                                {/* Accordion for Bill items (prescribed medications & services) */}
                                <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
                                  <button
                                    type="button"
                                    onClick={() => toggleInvoiceAccordion(data.id)}
                                    className="w-full flex items-center justify-between p-2.5 text-[10px] font-bold text-slate-555 hover:bg-slate-50 transition cursor-pointer"
                                  >
                                    <span>Prescribed Drugs & Bill Item Details ({data.items?.length || 0})</span>
                                    {expandedInvoices[data.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  {expandedInvoices[data.id] && (
                                    <div className="divide-y divide-slate-100 border-t border-slate-150 bg-slate-50/20 text-[11px] overflow-x-auto">
                                      <table className="w-full text-left">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100 text-[9px] uppercase tracking-wider">
                                            <th className="py-2 px-3">Item Name</th>
                                            <th className="py-2 px-3 text-center">Qty</th>
                                            <th className="py-2 px-3 text-right">Price</th>
                                            <th className="py-2 px-3 text-right">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-650">
                                          {(data.items || []).map((bItem, idx) => {
                                            let displayName = 'Custom Service / Consultation';
                                            let displayBatch = null;
                                            if (bItem.item_type === 'Inventory' && bItem.item_id) {
                                              const inv = inventory.find(i => i.id === bItem.item_id);
                                              displayName = inv?.item_name || 'Medicine Product';
                                              displayBatch = inv?.batch_number;
                                            } else if (bItem.item_type === 'Room') {
                                              displayName = 'Ward Bed Stay Charges';
                                            } else if (bItem.item_type === 'Service') {
                                              displayName = 'Medical Consultation / Lab Fee';
                                            }
                                            return (
                                              <tr key={idx} className="hover:bg-slate-50 transition">
                                                <td className="py-2 px-3">
                                                  <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800">{displayName}</span>
                                                    {displayBatch && (
                                                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">Batch: {displayBatch}</span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-3 text-center font-semibold text-slate-800">{bItem.quantity}</td>
                                                <td className="py-2 px-3 text-right">₹{Number(bItem.unit_price).toFixed(2)}</td>
                                                <td className="py-2 px-3 text-right font-semibold text-slate-800">₹{Number(bItem.subtotal || (bItem.quantity * bItem.unit_price)).toFixed(2)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
