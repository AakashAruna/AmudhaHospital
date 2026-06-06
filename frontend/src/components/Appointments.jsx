import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  AlertCircle,
  Sparkles,
  Phone,
  UserPlus,
  Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const Appointments = () => {
  const { apiFetch, user } = useAuth();
  
  // Data lists
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Search
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  
  // Inline Patient Create State
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState(30);
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newPatientContact, setNewPatientContact] = useState('');
  const [newPatientAdmission, setNewPatientAdmission] = useState('Outpatient');
  
  // Autocomplete patient dropdown search
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  
  // Form states
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState(0);
  const [patientGender, setPatientGender] = useState('Male');
  const [patientContact, setPatientContact] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [reason, setReason] = useState('');
  
  // Next queue preview
  const [nextQueuePreview, setNextQueuePreview] = useState(null);
  
  // Fetch next available queue number dynamically
  useEffect(() => {
    const fetchNextQueue = async () => {
      if (!doctorName || !appointmentDate) {
        setNextQueuePreview(null);
        return;
      }
      try {
        const url = `http://localhost:8000/api/appointments/next-queue?doctor_name=${encodeURIComponent(doctorName)}&appointment_date=${encodeURIComponent(appointmentDate)}`;
        const data = await apiFetch(url);
        setNextQueuePreview(data.next_queue);
      } catch (err) {
        console.error('Error fetching next queue:', err);
        setNextQueuePreview(null);
      }
    };
    fetchNextQueue();
  }, [doctorName, appointmentDate]);
  
  // Dashboard Quick Metrics
  const [metrics, setMetrics] = useState({
    todayCount: 0,
    upcomingCount: 0,
    scheduledCount: 0
  });

  // Fetch appointments and metrics
  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:8000/api/appointments?date_filter=${dateFilter}&q=${encodeURIComponent(search)}${doctorFilter ? `&doctor=${encodeURIComponent(doctorFilter)}` : ''}`;
      const data = await apiFetch(url);
      setAppointments(data);
      
      // Calculate simple client-side metrics from all appointments
      const allAppts = await apiFetch(`http://localhost:8000/api/appointments?date_filter=all`);
      const todayStr = new Date().toISOString().split('T')[0];
      
      const todayCount = allAppts.filter(a => a.appointment_date === todayStr && a.status === 'Completed').length;
      const upcomingCount = allAppts.filter(a => a.appointment_date > todayStr && a.status !== 'Cancelled').length;
      const scheduledCount = allAppts.filter(a => a.status === 'Scheduled').length;
      
      setMetrics({ todayCount, upcomingCount, scheduledCount });
    } catch (err) {
      setError(err.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing patient profiles for autocompletion
  const fetchPatients = async () => {
    try {
      const data = await apiFetch(`http://localhost:8000/api/billing/patients`);
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patient records', err);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [dateFilter, search, doctorFilter]);

  useEffect(() => {
    fetchPatients();
  }, [isModalOpen, isPatientModalOpen]);

  const handleOpenAddModal = () => {
    setPatientName('');
    setPatientAge(0);
    setPatientGender('Male');
    setPatientContact('');
    setDoctorName('');
    
    // Set default date to today
    const todayStr = new Date().toISOString().split('T')[0];
    setAppointmentDate(todayStr);
    
    // Format current time as e.g. 10:30 AM
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    const timeStr = `${hours}:${minutesStr} ${ampm}`;
    setAppointmentTime(timeStr);
    
    setReason('');
    setPatientSearch('');
    setShowPatientDropdown(false);
    setNextQueuePreview(null);
    
    setIsModalOpen(true);
  };

  const handleOpenPatientModal = () => {
    setNewPatientName('');
    setNewPatientAge(30);
    setNewPatientGender('Male');
    setNewPatientContact('');
    setNewPatientAdmission('Outpatient');
    setIsPatientModalOpen(true);
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newPatientName || !newPatientContact) return;

    try {
      const data = await apiFetch('http://localhost:8000/api/billing/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPatientName,
          age: Number(newPatientAge),
          gender: newPatientGender,
          contact: newPatientContact,
          admission_status: newPatientAdmission
        })
      });
      fetchPatients();
      setIsPatientModalOpen(false);
      
      // Auto-select this registered patient in booking fields if booking modal is opened
      setPatientName(data.name);
      setPatientAge(data.age);
      setPatientGender(data.gender);
      setPatientContact(data.contact);
      setPatientSearch(data.name);
      
      alert(`Patient ${data.name} registered successfully!`);
    } catch (err) {
      alert(err.message || 'Error creating patient');
    }
  };

  // Handle selecting patient from autocomplete
  const handleSelectPatient = (pat) => {
    setPatientName(pat.name);
    setPatientAge(pat.age);
    setPatientGender(pat.gender);
    setPatientContact(pat.contact);
    setPatientSearch(pat.name);
    setShowPatientDropdown(false);
  };

  // Create appointment
  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    if (!patientName || patientAge <= 0 || !doctorName || !appointmentDate || !appointmentTime) {
      alert('Please fill out all required fields.');
      return;
    }

    const payload = {
      patient_name: patientName,
      patient_age: Number(patientAge),
      patient_gender: patientGender,
      patient_contact: patientContact,
      doctor_name: doctorName,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      reason: reason || null
    };

    try {
      await apiFetch('http://localhost:8000/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Error scheduling appointment.');
    }
  };

  // Update status (Mark Completed / Cancel)
  const handleUpdateStatus = async (id, nextStatus) => {
    try {
      await apiFetch(`http://localhost:8000/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Error updating appointment status.');
    }
  };

  // Delete appointment
  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appointment record?')) return;
    try {
      await apiFetch(`http://localhost:8000/api/appointments/${id}`, {
        method: 'DELETE'
      });
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Error deleting appointment.');
    }
  };

  // Filtered patients for dropdown selection
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.contact.includes(patientSearch)
  );

  // Status style helper
  const getStatusBadgeStyle = (statusStr) => {
    switch (statusStr) {
      case 'Completed':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  // Unique list of doctors for filter dropdown
  const doctorsList = [
    'Dr. Kannappan',
    'Dr. Suriya'
  ];

  const handleExportCSV = () => {
    const headers = [
      { key: 'patient_name', label: 'Patient Name' },
      { key: 'patient_age', label: 'Age' },
      { key: 'patient_gender', label: 'Gender' },
      { key: 'patient_contact', label: 'Contact' },
      { key: 'doctor_name', label: 'Doctor Assigned' },
      { key: 'appointment_date', label: 'Date' },
      { key: 'appointment_time', label: 'Time' },
      { key: 'queue_number', label: 'Token Number' },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status' },
      { key: 'created_by', label: 'Booked By' }
    ];
    exportToCSV(appointments, headers, 'hms_appointments');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">Schedule and manage consultations, clinical queues, and appointments.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 shadow-sm transition active:scale-95 duration-100"
            title="Export to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenPatientModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 shadow-sm transition active:scale-95 duration-100"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            <span>Register Patient</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 shadow-sm transition active:scale-95 duration-100"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Today's Visits</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{metrics.todayCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Upcoming Visits</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{metrics.upcomingCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Scheduled</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{metrics.scheduledCount}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchAppointments} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Filters Deck */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
        {/* Toggle tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit self-start">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              dateFilter === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Appointments
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              dateFilter === 'today' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('upcoming')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              dateFilter === 'upcoming' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Upcoming
          </button>
        </div>

        {/* Text search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search appointments by patient name or doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs transition"
          />
        </div>

        {/* Doctor filter dropdown */}
        <div className="relative w-full lg:w-56">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Filter className="w-4 h-4" />
          </div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs appearance-none cursor-pointer"
          >
            <option value="">All Doctors</option>
            {doctorsList.map((doc, idx) => (
              <option key={idx} value={doc}>{doc}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading && appointments.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No patient appointments found matching the current criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6">Patient Details</th>
                    <th className="py-4 px-6">Doctor Assigned</th>
                    <th className="py-4 px-6">Date & Time</th>
                    <th className="py-4 px-6">Reason for Visit</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Booked By</th>
                    <th className="py-4 px-6 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{appt.patient_name}</span>
                          <span className="text-xs text-slate-400 mt-0.5">
                            {appt.patient_age} yrs • {appt.patient_gender}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {appt.patient_contact}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800">
                        {appt.doctor_name}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{appt.appointment_date}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Token #{appt.queue_number || '-'}
                            </span>
                            {appt.appointment_time && (
                              <span className="text-xs text-slate-400 font-mono">{appt.appointment_time}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate text-slate-500" title={appt.reason || ''}>
                        {appt.reason || <span className="text-slate-350 italic">None provided</span>}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusBadgeStyle(appt.status)}`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs font-mono text-slate-500">
                        {appt.created_by}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2 no-print">
                        {appt.status === 'Scheduled' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(appt.id, 'Completed')}
                              className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-150 px-2.5 py-1.5 rounded-lg transition"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(appt.id, 'Cancelled')}
                              className="text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-150 px-2.5 py-1.5 rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteAppointment(appt.id)}
                          className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition inline-flex items-center"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100 bg-white">
              {appointments.map((appt) => (
                <div key={appt.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{appt.patient_name}</h4>
                      <span className="text-xs text-slate-400 block mt-0.5">
                        {appt.patient_age} yrs • {appt.patient_gender}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(appt.status)}`}>
                      {appt.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Doctor</span>
                      <span className="font-semibold text-slate-800">{appt.doctor_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Token & Time</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                          #{appt.queue_number || '-'}
                        </span>
                        {appt.appointment_time && <span className="font-mono text-slate-500">{appt.appointment_time}</span>}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Date</span>
                      <span className="font-medium text-slate-700">{appt.appointment_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Contact</span>
                      <span className="font-mono text-slate-600 block truncate">{appt.patient_contact}</span>
                    </div>
                    {appt.reason && (
                      <div className="col-span-2 border-t border-slate-200/60 pt-2 mt-1">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Reason for Visit</span>
                        <span className="text-slate-600 block italic mt-0.5">{appt.reason}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 text-xs">
                    <span className="text-[10px] font-mono text-slate-400">Booked: {appt.created_by}</span>
                    <div className="flex gap-2 no-print">
                      {appt.status === 'Scheduled' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(appt.id, 'Completed')}
                            className="text-[11px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-150 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(appt.id, 'Cancelled')}
                            className="text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-150 px-2.5 py-1.5 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteAppointment(appt.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition"
                        title="Delete record"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Book Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <span>Book Patient Appointment</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 hover:bg-slate-105 rounded-lg transition text-slate-500"
              >
                <XClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="p-6 space-y-4 text-sm">
              
              {/* Existing Patient Search Combobox */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Patient Search (Autocomplete or Type Details Below)
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search existing patients..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setPatientName(e.target.value); // Let them write directly if they choose
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition font-medium"
                  />
                  {showPatientDropdown && patientSearch && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowPatientDropdown(false)} 
                      />
                      <div className="absolute z-20 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {filteredPatients.length === 0 ? (
                          <div className="p-3 text-xs text-slate-450 italic">
                            No matching patient profile. (Will schedule as a new patient)
                          </div>
                        ) : (
                          filteredPatients.map(pat => (
                            <button
                              key={pat.id}
                              type="button"
                              onClick={() => handleSelectPatient(pat)}
                              className="w-full text-left p-3 hover:bg-slate-50 transition flex justify-between items-center text-xs"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{pat.name}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">Contact: {pat.contact}</span>
                              </div>
                              <span className="bg-slate-100 text-slate-650 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {pat.age} yrs • {pat.gender}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Patient Fields Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Name *</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Enter patient name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Age *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={patientAge || ''}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Age"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Gender *</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contact No *</label>
                  <input
                    type="text"
                    required
                    value={patientContact}
                    onChange={(e) => setPatientContact(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Phone"
                  />
                </div>
              </div>

              {/* Consultation Details */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Consulting Doctor *</label>
                <select
                  required
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                >
                  <option value="">Select Doctor</option>
                  {doctorsList.map((doc, idx) => (
                    <option key={idx} value={doc}>{doc}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date *</label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Time (e.g. 10:30 AM) *</label>
                  <input
                    type="text"
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="e.g. 10:30 AM"
                  />
                </div>
              </div>

              {nextQueuePreview !== null && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between text-emerald-800 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold">Queue status for selected slot:</span>
                  </div>
                  <span className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                    Next Token: #{nextQueuePreview}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Appointment</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Symptoms, routing department details, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Patient Modal */}
      {isPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <span>Register New Patient</span>
              </h3>
              <button 
                onClick={() => setIsPatientModalOpen(false)} 
                className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500"
              >
                <XClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Enter patient full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Age *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Gender *</label>
                  <select
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number *</label>
                <input
                  type="text"
                  required
                  value={newPatientContact}
                  onChange={(e) => setNewPatientContact(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="e.g., +91 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Admission Status *</label>
                <select
                  value={newPatientAdmission}
                  onChange={(e) => setNewPatientAdmission(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                >
                  <option value="Outpatient">Outpatient</option>
                  <option value="Inpatient">Inpatient</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const XClose = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
