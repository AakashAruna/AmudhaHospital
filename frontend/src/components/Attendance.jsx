import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Download, 
  UserPlus, 
  Trash2,
  ShieldAlert,
  ClipboardList,
  Edit2,
  Users,
  AlertCircle,
  Clock
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const Attendance = () => {
  const { apiFetch, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffList, setStaffList] = useState([]);
  
  // Tabs: 'attendance' or 'roster'
  const [activeSubTab, setActiveSubTab] = useState('attendance');

  // Attendance Date
  const [adminDate, setAdminDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [adminLogs, setAdminLogs] = useState([]);

  // Attendance Override Modal state
  const [editingEntry, setEditingEntry] = useState(null);
  const [editStatus, setEditStatus] = useState('Present');
  const [editNotes, setEditNotes] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [togglingUserId, setTogglingUserId] = useState(null);

  // Register User Modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regRole, setRegRole] = useState('Pharmacist');
  const [regBaseSalary, setRegBaseSalary] = useState('0.00');

  // Base salary editing state
  const [editingSalaryUserId, setEditingSalaryUserId] = useState(null);
  const [tempSalaryVal, setTempSalaryVal] = useState('');

  // Salary Slips Date Range
  const getPastDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-CA');
  };

  const [startDate, setStartDate] = useState(() => getPastDateStr(30));
  const [endDate, setEndDate] = useState(() => getPastDateStr(0));
  const [payrollLogs, setPayrollLogs] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [additions, setAdditions] = useState(0);
  const [deductions, setDeductions] = useState(0);

  // Calendar Holidays state
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayDesc, setHolidayDesc] = useState('');
  const [holidaysList, setHolidaysList] = useState([]);

  const fetchDirectoryAndLogs = async () => {
    try {
      const [users, logs, holidays] = await Promise.all([
        apiFetch('/api/auth/users'),
        apiFetch(`/api/attendance?date=${adminDate}`),
        apiFetch('/api/attendance/holidays')
      ]);
      setStaffList(users);
      setAdminLogs(logs);
      setHolidaysList(holidays);
    } catch (err) {
      setError(err.message || 'Failed to fetch staff roster or logs');
    }
  };

  const fetchPayrollLogs = async () => {
    try {
      setLoading(true);
      const [users, logs, holidays] = await Promise.all([
        apiFetch('/api/auth/users'),
        apiFetch(`/api/attendance?start_date=${startDate}&end_date=${endDate}`),
        apiFetch('/api/attendance/holidays')
      ]);
      setStaffList(users);
      setPayrollLogs(logs);
      setHolidaysList(holidays);
    } catch (err) {
      setError(err.message || 'Failed to fetch payroll logs');
    } finally {
      setLoading(false);
    }
  };

  const initData = async () => {
    setLoading(true);
    setError(null);
    await fetchDirectoryAndLogs();
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      if (activeSubTab === 'salary_slips') {
        fetchPayrollLogs();
      } else {
        initData();
      }
    }
  }, [user, activeSubTab, adminDate, startDate, endDate]);

  const handleOpenOverride = (staffUser) => {
    const log = adminLogs.find(l => l.user_id === staffUser.id);
    setEditingEntry({
      user_id: staffUser.id,
      full_name: staffUser.full_name,
      role: staffUser.role,
      date: adminDate,
      log_id: log?.id || null
    });
    setEditStatus(log?.status || 'Present');
    setEditNotes(log?.notes || '');
    
    // Format ISO string to datetime-local format: YYYY-MM-DDTHH:MM
    const formatDateTime = (dateVal) => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    setEditCheckIn(log?.check_in ? formatDateTime(log.check_in) : '');
    setEditCheckOut(log?.check_out ? formatDateTime(log.check_out) : '');
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!editingEntry) return;

    try {
      setError(null);
      const res = await apiFetch('/api/attendance/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editingEntry.user_id,
          date: editingEntry.date,
          status: editStatus,
          check_in: editCheckIn || null,
          check_out: editCheckOut || null,
          notes: editNotes || null
        })
      });

      // Update in logs state
      setAdminLogs(prev => {
        const exists = prev.some(l => l.user_id === editingEntry.user_id);
        if (exists) {
          return prev.map(l => l.user_id === editingEntry.user_id ? res : l);
        }
        return [...prev, res];
      });

      setEditingEntry(null);
    } catch (err) {
      alert(err.message || 'Failed to save attendance override');
    }
  };

  const handleToggleAttendance = async (userId, currentStatus) => {
    const nextStatus = (currentStatus === 'Present' || currentStatus === 'Half Day') ? 'Absent' : 'Present';
    let nextCheckIn = null;
    let nextCheckOut = null;
    
    if (nextStatus === 'Present') {
      const now = new Date();
      const [year, month, day] = adminDate.split('-');
      const checkInDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      nextCheckIn = checkInDate.toISOString();
    }

    try {
      setTogglingUserId(userId);
      setError(null);
      const res = await apiFetch('/api/attendance/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          date: adminDate,
          status: nextStatus,
          check_in: nextCheckIn,
          check_out: nextCheckOut,
          notes: null
        })
      });

      setAdminLogs(prev => {
        const exists = prev.some(l => l.user_id === userId);
        if (exists) {
          return prev.map(l => l.user_id === userId ? res : l);
        }
        return [...prev, res];
      });
    } catch (err) {
      alert(err.message || 'Failed to toggle attendance status');
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    if (!regUsername || !regPassword || !regFullName || !regRole) return;

    try {
      setError(null);
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          full_name: regFullName,
          role: regRole,
          base_salary: Number(regBaseSalary) || 0.00
        })
      });

      setStaffList(prev => [...prev, res]);
      
      // Reset
      setRegUsername('');
      setRegPassword('');
      setRegFullName('');
      setRegRole('Pharmacist');
      setRegBaseSalary('0.00');
      setIsRegisterModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to register new staff account');
    }
  };

  const handleSaveSalary = async (userId) => {
    try {
      setError(null);
      const res = await apiFetch(`/api/auth/users/${userId}/salary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_salary: Number(tempSalaryVal) || 0.00 })
      });
      setStaffList(prev => prev.map(s => s.id === userId ? { ...s, base_salary: res.base_salary } : s));
      setEditingSalaryUserId(null);
    } catch (err) {
      alert(err.message || 'Failed to update salary');
    }
  };

  const handleDeleteStaff = async (staffId, fullName) => {
    if (staffId === user.id) {
      alert('You cannot delete your own admin profile.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete staff member "${fullName}"? This will permanently remove their credentials and login access.`)) {
      return;
    }

    try {
      setError(null);
      await apiFetch(`/api/auth/users/${staffId}`, {
        method: 'DELETE'
      });

      setStaffList(prev => prev.filter(u => u.id !== staffId));
      setAdminLogs(prev => prev.filter(l => l.user_id !== staffId));
    } catch (err) {
      alert(err.message || 'Failed to delete staff account');
    }
  };

  const handleDeclareHoliday = async (e) => {
    e.preventDefault();
    if (!holidayDate) return;

    try {
      setError(null);
      const res = await apiFetch('/api/attendance/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: holidayDate, description: holidayDesc })
      });
      setHolidaysList(prev => {
        const exists = prev.some(h => h.date === holidayDate);
        if (exists) {
          return prev.map(h => h.date === holidayDate ? res : h);
        }
        return [...prev, res].sort((a, b) => a.date.localeCompare(b.date));
      });
      setHolidayDate('');
      setHolidayDesc('');
      setIsHolidayModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to declare holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday? This will revert this date back to a standard working day.')) return;

    try {
      setError(null);
      await apiFetch(`/api/attendance/holidays/${holidayId}`, {
        method: 'DELETE'
      });
      setHolidaysList(prev => prev.filter(h => h.id !== holidayId));
    } catch (err) {
      alert(err.message || 'Failed to delete holiday');
    }
  };

  const handleExportCSV = () => {
    const headers = [
      { key: 'user.full_name', label: 'Staff Name' },
      { key: 'user.role', label: 'Role' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'check_in', label: 'Check In' },
      { key: 'check_out', label: 'Check Out' },
      { key: 'notes', label: 'Remarks / Notes' }
    ];
    
    const exportData = staffList.map(u => {
      const log = adminLogs.find(l => l.user_id === u.id);
      return {
        user: {
          full_name: u.full_name,
          role: u.role
        },
        date: adminDate,
        status: log ? log.status : 'Absent',
        check_in: log?.check_in ? new Date(log.check_in).toLocaleTimeString() : '-',
        check_out: log?.check_out ? new Date(log.check_out).toLocaleTimeString() : '-',
        notes: log?.notes || '-'
      };
    });

    exportToCSV(exportData, headers, `hms_attendance_${adminDate}`);
  };

  const getStatusColorClass = (statusStr) => {
    switch (statusStr) {
      case 'Present':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Half Day':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Leave':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const getDatesRange = (startStr, endStr) => {
    const dates = [];
    if (!startStr || !endStr) return dates;
    let current = new Date(startStr);
    const end = new Date(endStr);
    while (current <= end) {
      dates.push(new Date(current).toLocaleDateString('en-CA'));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const getDaysAndWorkingDaysInMonthOfDate = (dateStr) => {
    if (!dateStr) return { totalDays: 30, sundays: 4, workingDays: 26 };
    const parts = dateStr.split('-');
    if (parts.length < 2) return { totalDays: 30, sundays: 4, workingDays: 26 };
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    let sundays = 0;
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === 0) {
        sundays++;
      }
    }

    const prefix = `${parts[0]}-${parts[1]}`;
    const monthHolidays = holidaysList.filter(h => h.date.startsWith(prefix));
    const nonSundayHolidaysCount = monthHolidays.filter(h => {
      const hp = h.date.split('-');
      const dObj = new Date(parseInt(hp[0], 10), parseInt(hp[1], 10) - 1, parseInt(hp[2], 10));
      return dObj.getDay() !== 0;
    }).length;

    return {
      totalDays,
      sundays,
      workingDays: totalDays - sundays - nonSundayHolidaysCount
    };
  };

  const calculatePayrollForUser = (staffUser) => {
    const dateRange = getDatesRange(startDate, endDate);
    const baseSalary = Number(staffUser.base_salary || 0);
    let totalBaseEarned = 0;
    let totalWorkedDays = 0;
    const breakdown = [];

    dateRange.forEach(dateStr => {
      const log = payrollLogs.find(l => l.user_id === staffUser.id && l.date === dateStr);
      let status = log ? log.status : 'Absent';
      
      const parts = dateStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      const isSunday = dateObj.getDay() === 0;
      const declaredHoliday = holidaysList.find(h => h.date === dateStr);

      const { workingDays } = getDaysAndWorkingDaysInMonthOfDate(dateStr);
      const dailyRate = baseSalary / (workingDays || 1);

      let earned = 0;
      let weight = 0;

      if (isSunday || declaredHoliday) {
        if (status === 'Present') {
          earned = dailyRate;
          weight = 1.0;
        } else if (status === 'Half Day') {
          earned = dailyRate * 0.5;
          weight = 0.5;
        } else {
          status = declaredHoliday 
            ? `Holiday (${declaredHoliday.description || 'Declared'})` 
            : 'Sunday (Holiday)';
          earned = 0;
          weight = 0;
        }
      } else {
        if (status === 'Present') {
          earned = dailyRate;
          weight = 1.0;
        } else if (status === 'Half Day') {
          earned = dailyRate * 0.5;
          weight = 0.5;
        }
      }

      totalBaseEarned += earned;
      totalWorkedDays += weight;

      breakdown.push({
        date: dateStr,
        status,
        dailyRate,
        earned
      });
    });

    return {
      totalBaseEarned,
      totalWorkedDays,
      breakdown
    };
  };

  const handlePrintSalarySlip = (employee, summary, addVal, dedVal) => {
    const netPayout = summary.totalBaseEarned + addVal - dedVal;
    const totalDays = getDatesRange(startDate, endDate).length;

    const formatDateDisplay = (dStr) => {
      if (!dStr) return '';
      const parts = dStr.split('-');
      if (parts.length < 3) return dStr;
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
    };

    const rowsHtml = summary.breakdown.map(day => {
      const isSundayHoliday = day.status === 'Sunday (Holiday)';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; font-size: 11px;">${formatDateDisplay(day.date)}</td>
          <td style="padding: 8px 12px; font-size: 11px; font-weight: bold; color: ${
            day.status === 'Present' ? '#059669' :
            day.status === 'Half Day' ? '#d97706' :
            isSundayHoliday ? '#64748b' : '#dc2626'
          }; font-style: ${isSundayHoliday ? 'italic' : 'normal'};">
            ${isSundayHoliday ? 'Holiday' : day.status}
          </td>
          <td style="padding: 8px 12px; font-size: 11px; text-align: right; font-family: monospace; color: ${isSundayHoliday ? '#94a3b8' : '#1e293b'};">
            ₹${isSundayHoliday ? '0.00' : day.dailyRate.toFixed(2)}
          </td>
          <td style="padding: 8px 12px; font-size: 11px; text-align: right; font-weight: bold; font-family: monospace; color: ${day.earned > 0 ? '#059669' : '#94a3b8'};">
            ₹${day.earned.toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    const slipHtml = `
      <div style="font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #10b981; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">AMUDHA HOSPITAL</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Staff Payslip &amp; Salary Statement</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; line-height: 1.6;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #64748b;">Employee Name:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${employee.full_name}</td>
            <td style="padding: 6px 0; font-weight: bold; width: 140px; color: #64748b;">Pay Period:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Role / Designation:</td>
            <td style="padding: 6px 0; color: #334155;">${employee.role}</td>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Monthly Base Salary:</td>
            <td style="padding: 6px 0; color: #334155; font-weight: bold;">₹${Number(employee.base_salary).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Total Period Days:</td>
            <td style="padding: 6px 0; color: #334155;">${totalDays} days</td>
            <td style="padding: 6px 0; font-weight: bold; color: #64748b;">Total Worked Days:</td>
            <td style="padding: 6px 0; color: #10b981; font-weight: bold;">${summary.totalWorkedDays} days</td>
          </tr>
        </table>

        <h3 style="font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Attendance &amp; Daily Wages Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #475569;">
              <th style="padding: 10px 12px; text-align: left;">Date</th>
              <th style="padding: 10px 12px; text-align: left;">Status</th>
              <th style="padding: 10px 12px; text-align: right;">Daily Wage Rate</th>
              <th style="padding: 10px 12px; text-align: right;">Earned Payout</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <table style="width: 280px; border-collapse: collapse; font-size: 12px; line-height: 2;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 6px 0; font-weight: 500; color: #475569;">Basic Earnings Payout:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace;">₹${summary.totalBaseEarned.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9; color: #059669;">
              <td style="padding: 6px 0; font-weight: 500;">Additions (Bonus / Incentives):</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">+ ₹${addVal.toFixed(2)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9; color: #dc2626;">
              <td style="padding: 6px 0; font-weight: 500;">Deductions (Advances / Taxes):</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 700; font-family: monospace;">- ₹${dedVal.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 2px solid #0f172a; font-size: 14px; color: #0f172a;">
              <td style="padding: 12px 0; font-weight: 800; text-transform: uppercase;">Net Payable Salary:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 800; color: #10b981; font-size: 18px; font-family: monospace;">₹${netPayout.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px;">
          <div style="text-align: center; width: 220px;">
            <div style="border-bottom: 1px solid #cbd5e1; height: 35px; margin-bottom: 6px;"></div>
            <p style="margin: 0; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Authorized Signatory</p>
          </div>
          <div style="text-align: center; width: 220px;">
            <div style="border-bottom: 1px solid #cbd5e1; height: 35px; margin-bottom: 6px;"></div>
            <p style="margin: 0; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Employee Signature</p>
          </div>
        </div>
      </div>
    `;

    let iframe = document.getElementById('salary-slip-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'salary-slip-print-iframe';
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Slip - ${employee.full_name}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            ${Array.from(document.styleSheets).map(styleSheet => {
              try {
                return Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('\n');
              } catch (e) {
                return '';
              }
            }).join('\n')}
            @media print {
              body {
                background: white;
                margin: 0;
                padding: 10mm;
              }
            }
          </style>
        </head>
        <body>
          <div style="padding: 10px 0;">
            ${slipHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
        <span>Access Denied. Only system administrators can access Staff Management.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn relative text-slate-800">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Staff Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage staff user profiles and daily duty attendance roster logs.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveSubTab('attendance')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-100 ${
              activeSubTab === 'attendance'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Attendance Logs
          </button>
          <button
            onClick={() => setActiveSubTab('roster')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-100 ${
              activeSubTab === 'roster'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Staff Directory
          </button>
          <button
            onClick={() => setActiveSubTab('salary_slips')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-100 ${
              activeSubTab === 'salary_slips'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Salary Slips
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </span>
          <button onClick={initData} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : activeSubTab === 'attendance' ? (
        // ATTENDANCE LOG SUB-TAB
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracking Date:</label>
              <input
                type="date"
                value={adminDate}
                onChange={(e) => setAdminDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-slate-50 hover:bg-slate-100/60 font-semibold"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(true)}
                className="flex items-center justify-center gap-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition active:scale-95 duration-100 shadow-sm"
              >
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Declare Holidays</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition active:scale-95 duration-100 shadow-sm"
                title="Export Report"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Export Daily CSV</span>
              </button>
            </div>
          </div>

          {/* Directory log table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6">Staff Name</th>
                    <th className="py-4 px-6">Role</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Check In</th>
                    <th className="py-4 px-6">Check Out</th>
                    <th className="py-4 px-6">Notes / Remarks</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffList.map((staffUser) => {
                    const log = adminLogs.find(l => l.user_id === staffUser.id);
                    const statusStr = log ? log.status : 'Absent';
                    
                    return (
                      <tr key={staffUser.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">{staffUser.full_name}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            staffUser.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            staffUser.role === 'Pharmacist' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {staffUser.role}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              disabled={togglingUserId === staffUser.id}
                              onClick={() => handleToggleAttendance(staffUser.id, statusStr)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                                (statusStr === 'Present' || statusStr === 'Half Day') ? 'bg-emerald-500' : 'bg-slate-200'
                              } ${togglingUserId === staffUser.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={statusStr === 'Present' || statusStr === 'Half Day' ? 'Mark Absent' : 'Mark Present'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  (statusStr === 'Present' || statusStr === 'Half Day') ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColorClass(statusStr)}`}>
                              {statusStr}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">
                          {log?.check_in ? new Date(log.check_in).toLocaleTimeString() : '-'}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">
                          {log?.check_out ? new Date(log.check_out).toLocaleTimeString() : '-'}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-500 truncate max-w-[200px]" title={log?.notes}>
                          {log?.notes || '-'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleOpenOverride(staffUser)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg transition"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Log Shift</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : activeSubTab === 'roster' ? (
        // STAFF DIRECTORY ROSTER SUB-TAB
        <div className="space-y-4">
          
          <div className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff Registered: {staffList.length}</span>
            </div>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 transition active:scale-95 duration-100 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Staff</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6">Name</th>
                    <th className="py-4 px-6">Username</th>
                    <th className="py-4 px-6">System Role</th>
                    <th className="py-4 px-6">Base Salary (₹/month)</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {staffList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900">{s.full_name}</td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-550">{s.username}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          s.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          s.role === 'Pharmacist' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {s.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {editingSalaryUserId === s.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={tempSalaryVal}
                              onChange={(e) => setTempSalaryVal(e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSalary(s.id);
                                if (e.key === 'Escape') setEditingSalaryUserId(null);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSalary(s.id)}
                              className="p-1 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition"
                              title="Save Salary"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSalaryUserId(null)}
                              className="p-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg transition"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">₹{Number(s.base_salary || 0).toFixed(2)}</span>
                            <button
                              onClick={() => {
                                setEditingSalaryUserId(s.id);
                                setTempSalaryVal(s.base_salary || 0);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition"
                              title="Edit Salary"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {s.id !== user.id ? (
                          <button
                            onClick={() => handleDeleteStaff(s.id, s.full_name)}
                            className="p-1.5 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition"
                            title="Delete Staff Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic px-2">Active Admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        // SALARY SLIPS SUB-TAB
        <div className="space-y-6 animate-fadeIn">
          {/* Custom Date Range Picker */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm justify-between items-center">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-slate-50 hover:bg-slate-100/60 font-semibold"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer bg-slate-50 hover:bg-slate-100/60 font-semibold"
                />
              </div>
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Period: {getDatesRange(startDate, endDate).length} Days
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: Staff Selector List */}
            <div className={`${selectedStaffId ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300`}>
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Staff Member</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30 text-slate-500 font-semibold text-xs">
                      <th className="py-3 px-4">Staff Name</th>
                      <th className="py-3 px-4">Base Salary</th>
                      {!selectedStaffId && (
                        <>
                          <th className="py-3 px-4">Duty Days</th>
                          <th className="py-3 px-4">Est. Earnings</th>
                        </>
                      )}
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {staffList.map((s) => {
                      const summary = calculatePayrollForUser(s);
                      const isSelected = selectedStaffId === s.id;
                      return (
                        <tr 
                          key={s.id} 
                          className={`hover:bg-slate-50/50 transition cursor-pointer ${isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : ''}`}
                          onClick={() => {
                            setSelectedStaffId(s.id);
                            setAdditions(0);
                            setDeductions(0);
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{s.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{s.role}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                            ₹{Number(s.base_salary || 0).toFixed(2)}
                          </td>
                          {!selectedStaffId && (
                            <>
                              <td className="py-3 px-4 font-semibold text-slate-600">
                                {summary.totalWorkedDays.toFixed(1)} / {getDatesRange(startDate, endDate).length}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs font-bold text-emerald-600">
                                ₹{summary.totalBaseEarned.toFixed(2)}
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStaffId(s.id);
                                setAdditions(0);
                                setDeductions(0);
                              }}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                                isSelected 
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isSelected ? 'Viewing' : 'View Slip'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Detailed Salary Slip View */}
            {selectedStaffId && (() => {
              const selectedStaff = staffList.find(s => s.id === selectedStaffId);
              if (!selectedStaff) return null;
              const summary = calculatePayrollForUser(selectedStaff);
              const netPayout = summary.totalBaseEarned + additions - deductions;

              return (
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fadeIn space-y-6 p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 font-sans">Salary Slip Statement</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Configure bonuses, check daily breakdowns, and print employee copy.
                      </p>
                    </div>
                    <button 
                      onClick={() => setSelectedStaffId(null)} 
                      className="text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition"
                    >
                      Close View
                    </button>
                  </div>

                  {/* Employee Details Summary Card */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs font-semibold text-slate-700 font-sans">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Employee Name</span>
                      <span className="text-slate-800 text-sm font-bold">{selectedStaff.full_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">System Role</span>
                      <span className="text-slate-800">{selectedStaff.role}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Monthly Salary</span>
                      <span className="text-slate-800 font-mono text-sm font-bold">₹{Number(selectedStaff.base_salary).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Custom Period</span>
                      <span className="text-slate-800 font-mono text-[11px]">{startDate} to {endDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Total Range Days</span>
                      <span className="text-slate-800">{getDatesRange(startDate, endDate).length} days</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Worked Duty Days</span>
                      <span className="text-emerald-600 text-sm font-bold">{summary.totalWorkedDays.toFixed(1)} days</span>
                    </div>
                  </div>

                  {/* Scrollable Day-by-Day Checklist */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Daily Wage & Attendance Breakdown</label>
                    <div className="max-h-[300px] overflow-y-auto border border-slate-150 rounded-2xl p-3 pr-2 bg-slate-50/20 space-y-1.5 scrollbar-thin">
                      {summary.breakdown.map((day) => {
                        // Format date display: e.g. "08 May 2026"
                        const formatDateLabel = (dStr) => {
                          const [y, m, d] = dStr.split('-');
                          const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          return `${d} ${mNames[parseInt(m, 10)-1]} ${y}`;
                        };
                        return (
                          <div key={day.date} className="flex justify-between items-center bg-white border border-slate-100 hover:border-slate-200/80 rounded-xl p-2.5 shadow-sm transition">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-slate-700 font-mono">{formatDateLabel(day.date)}</span>
                              {day.status === 'Present' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-150">(Present)</span>
                              )}
                              {day.status === 'Half Day' && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-150">(Half Day)</span>
                              )}
                              {(day.status === 'Sunday (Holiday)' || day.status.startsWith('Holiday')) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 uppercase tracking-wider font-sans text-center">
                                  {day.status.startsWith('Holiday') ? (day.status.slice(9, -1) || 'Holiday') : 'Holiday'}
                                </span>
                              )}
                              {(day.status === 'Absent' || day.status === 'Leave') && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-100 text-orange-700 border-orange-200 uppercase tracking-wider font-sans">ABSENT</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-mono">Rate: ₹{(day.status === 'Sunday (Holiday)' || day.status.startsWith('Holiday')) ? '0.00' : day.dailyRate.toFixed(2)}</span>
                              <span className={`text-xs font-bold font-mono ${day.earned > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {day.earned > 0 ? `+ ₹${day.earned.toFixed(2)}` : '₹0.00'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additions and Deductions Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-700 font-sans">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Additions (Bonuses, Overtime, Allowances)</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3.5 top-2.5 text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={additions === 0 ? '' : additions}
                          placeholder="0.00"
                          onChange={(e) => setAdditions(Number(e.target.value) || 0)}
                          className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deductions (Taxes, Advances, Deducts)</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3.5 top-2.5 text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={deductions === 0 ? '' : deductions}
                          placeholder="0.00"
                          onChange={(e) => setDeductions(Number(e.target.value) || 0)}
                          className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary readout */}
                  <div className="border-t border-slate-150 pt-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 font-sans">
                    <div className="grid grid-cols-3 gap-6 text-xs text-slate-500">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Basic Payout</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">₹{summary.totalBaseEarned.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-emerald-500 font-semibold">Additions (+)</span>
                        <span className="font-mono font-bold text-emerald-600 text-sm">+ ₹{additions.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-red-500 font-semibold">Deductions (-)</span>
                        <span className="font-mono font-bold text-red-600 text-sm">- ₹{deductions.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Payout</span>
                      <span className="font-mono text-xl font-black text-emerald-600">₹{netPayout.toFixed(2)}</span>
                    </div>
                  </div>


                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Override dialog modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-500" />
                <span>Duty Shift Logs</span>
              </h3>
              <button onClick={() => setEditingEntry(null)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveOverride} className="p-6 space-y-4 text-xs font-semibold text-slate-700 font-sans">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Staff Member:</span>
                  <span className="font-bold text-slate-800">{editingEntry.full_name} ({editingEntry.role})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-bold text-slate-800">{editingEntry.date}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                >
                  <option value="Present">Present</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Leave">Leave / Sick</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Check In Time</label>
                  <input
                    type="datetime-local"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Check Out Time</label>
                  <input
                    type="datetime-local"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes / Remarks</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows="3"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Reason for absence or override remarks..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Save Shift Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Staff Dialog modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <span>Register Staff Account</span>
              </h3>
              <button onClick={() => setIsRegisterModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRegisterStaff} className="p-6 space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Watson"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Role *</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white cursor-pointer"
                >
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Billing Clerk">Billing Clerk</option>
                  <option value="Admin">System Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. watson"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter initial password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Monthly Salary (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="e.g. 9000"
                  value={regBaseSalary}
                  onChange={(e) => setRegBaseSalary(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Declare Holidays dialog modal */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <span>Declare Calendar Holidays</span>
              </h3>
              <button onClick={() => setIsHolidayModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Form to declare holiday */}
              <form onSubmit={handleDeclareHoliday} className="space-y-4 text-xs font-semibold text-slate-700 font-sans">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Holiday Date *</label>
                    <input
                      type="date"
                      required
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Holiday Name / Occasion *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diwali Holiday"
                      value={holidayDesc}
                      onChange={(e) => setHolidayDesc(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition active:scale-95 duration-100 cursor-pointer"
                  >
                    Add Holiday
                  </button>
                </div>
              </form>

              {/* List of holidays */}
              <div className="space-y-2 border-t border-slate-100 pt-4 font-sans">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Declared Holidays List</label>
                {holidaysList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No custom holidays declared yet.</p>
                ) : (
                  <div className="max-h-[200px] overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/20 scrollbar-thin">
                    {holidaysList.map(h => (
                      <div key={h.id} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl p-2.5 shadow-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold font-mono text-slate-700">{h.date}</span>
                          <span className="text-xs font-semibold text-slate-800 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">{h.description || 'Holiday'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1 text-red-500 hover:bg-red-550 border border-transparent rounded-lg transition"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 bg-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const XCloseIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
