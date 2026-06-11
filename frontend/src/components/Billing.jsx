import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  CreditCard, 
  Calculator, 
  User, 
  UserPlus,
  AlertCircle,
  Download,
  Calendar
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const Billing = () => {
  const { apiFetch, user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab state: 'list' or 'create'
  const [activeSubTab, setActiveSubTab] = useState('list');

  // Searchable combobox states
  const [openDropdownIdx, setOpenDropdownIdx] = useState(null);
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // Search states
  const [invoiceSearch, setInvoiceSearch] = useState('');
  
  // Create Invoice States
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorName, setSelectedDoctorName] = useState('');
  const [discount, setDiscount] = useState(0.00);
  const [insuranceCovered, setInsuranceCovered] = useState(0.00);
  const [billItems, setBillItems] = useState([]);
  
  // Inline Patient Create State
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState(30);
  const [newPatientGender, setNewPatientGender] = useState('Male');
  const [newPatientContact, setNewPatientContact] = useState('');
  const [newPatientAdmission, setNewPatientAdmission] = useState('Outpatient');

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Checkout Modal State
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState(0.00);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [checkoutError, setCheckoutError] = useState(null);

  // Printable state (holds invoice target for printable layout)
  const [printTargetInvoice, setPrintTargetInvoice] = useState(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  const canWrite = user?.role === 'Admin' || user?.role === 'Billing Clerk';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, patRes, inventoryRes] = await Promise.all([
        apiFetch('/api/billing/invoices'),
        apiFetch('/api/billing/patients'),
        apiFetch('/api/inventory') // Fetch to allow item drop-down matching!
      ]);
      setInvoices(invRes);
      setPatients(patRes);
      setInventory(inventoryRes);
    } catch (err) {
      setError(err.message || 'Failed to fetch billing resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      const isClerkOrAdmin = user.role === 'Admin' || user.role === 'Billing Clerk';
      setActiveSubTab(isClerkOrAdmin ? 'create' : 'list');
    }
  }, [user]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newPatientName || !newPatientContact) return;

    try {
      const data = await apiFetch('/api/billing/patients', {
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
      setPatients(prev => [...prev, data]);
      setSelectedPatientId(data.id);
      setIsPatientModalOpen(false);
      
      // Reset Patient Form
      setNewPatientName('');
      setNewPatientAge(30);
      setNewPatientGender('Male');
      setNewPatientContact('');
      setNewPatientAdmission('Outpatient');
    } catch (err) {
      alert(err.message || 'Error creating patient');
    }
  };

  const addBillItemLine = () => {
    setBillItems(prev => [
      ...prev,
      { item_type: 'Service', item_id: '', quantity: 1, unit_price: 0.00 }
    ]);
  };

  const removeBillItemLine = (idx) => {
    setBillItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateBillItemLine = (idx, updatedFields) => {
    setBillItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      
      const newValues = { ...item, ...updatedFields };
      
      // If updating item_id for Inventory type, fill default inventory price
      if (updatedFields.item_id && newValues.item_type === 'Inventory') {
        const selectedInv = inventory.find(inv => inv.id === updatedFields.item_id);
        if (selectedInv) {
          newValues.unit_price = Number(selectedInv.unit_price);
        }
      }
      return newValues;
    }));
  };

  // Math aggregates for draft invoice
  const getSubtotal = () => {
    return billItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };
  const getTax = () => getSubtotal() * 0.10;
  const getGrossTotal = () => getSubtotal() + getTax();
  const getPatientDue = () => {
    const due = getGrossTotal() - discount - insuranceCovered;
    return due > 0 ? due : 0;
  };

  const handleGenerateInvoice = async () => {
    if (!selectedPatientId) {
      alert('Please select a patient.');
      return;
    }
    if (billItems.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    // Verify all inventory items have IDs chosen
    const invalidItem = billItems.find(item => item.item_type === 'Inventory' && !item.item_id);
    if (invalidItem) {
      alert('Please choose a product from the list for all Inventory rows.');
      return;
    }

    const payload = {
      patient_id: selectedPatientId,
      discount: Number(discount),
      insurance_covered: Number(insuranceCovered),
      doctor_name: selectedDoctorName || null,
      items: billItems.map(item => ({
        item_type: item.item_type,
        item_id: item.item_type === 'Inventory' ? item.item_id : null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    };

    try {
      await apiFetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // Clear forms
      setSelectedPatientId('');
      setSelectedDoctorName('');
      setDiscount(0.00);
      setInsuranceCovered(0.00);
      setBillItems([]);
      setPatientSearchQuery('');
      setActiveSubTab('list');
      fetchData(); // Reload invoices
    } catch (err) {
      alert(err.message || 'Error generating invoice');
    }
  };

  const handleOpenCheckout = (inv) => {
    setCheckoutInvoice(inv);
    setPayAmount(Number(inv.out_of_pocket_due));
    setPaymentMode('Cash');
    setReferenceNumber('');
    setCheckoutError(null);
  };

  const handleProcessCheckout = async (e) => {
    e.preventDefault();
    if (!checkoutInvoice) return;
    setCheckoutError(null);

    try {
      await apiFetch(`/api/payments/checkout/${checkoutInvoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paid: Number(payAmount),
          payment_mode: paymentMode,
          reference_number: referenceNumber || null
        })
      });
      setCheckoutInvoice(null);
      fetchData(); // Refresh both invoices and ledger numbers
    } catch (err) {
      setCheckoutError(err.message || 'Error posting payment');
    }
  };

  const handlePrint = (inv) => {
    setPrintTargetInvoice(inv);
    setIsPrintPreviewOpen(true);
  };

  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const oklchToRgbString = (oklchStr) => {
    return oklchStr.replace(/oklch\([^\)]+\)/g, (match) => {
      try {
        const content = match.substring(6, match.length - 1).trim();
        const parts = content.split(/[\s,/]+/).filter(Boolean);
        if (parts.length < 3) return match;
        
        let l = parts[0] === 'none' ? 0 : parseFloat(parts[0]);
        if (parts[0].includes('%')) l /= 100;
        let c = parts[1] === 'none' ? 0 : parseFloat(parts[1]);
        if (parts[1].includes('%')) c /= 100;
        let h = parts[2] === 'none' ? 0 : parseFloat(parts[2]);
        let a = 1;
        if (parts[3] !== undefined) {
          a = parts[3] === 'none' ? 0 : parseFloat(parts[3]);
          if (parts[3].includes('%')) a /= 100;
        }
        
        const L = l;
        const a_ = c * Math.cos((h * Math.PI) / 180);
        const b_ = c * Math.sin((h * Math.PI) / 180);
        
        const l_ = L + 0.3963377774 * a_ + 0.2158037573 * b_;
        const m_ = L - 0.1055613458 * a_ - 0.0638541728 * b_;
        const s_ = L - 0.0894841775 * a_ - 1.291485548 * b_;
        
        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;
        
        const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        const gL = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        const bL = -0.0041960863 * l3 - 0.703418614 * m3 + 1.7076146975 * s3;
        
        const f = (val) => (val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055);
        
        const r = Math.max(0, Math.min(255, Math.round(f(rL) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(f(gL) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(f(bL) * 255)));
        
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      } catch (e) {
        return match;
      }
    });
  };

  const printInvoiceContent = () => {
    if (!printTargetInvoice) return;
    
    // Create print container iframe if it doesn't exist
    let iframe = document.getElementById('invoice-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'invoice-print-iframe';
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }
    
    const printContent = document.getElementById('invoice-print-area').innerHTML;
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Invoice #${printTargetInvoice.id.substring(0, 12).toUpperCase()}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            /* Copy all parent style definitions */
            ${Array.from(document.styleSheets).map(styleSheet => {
              try {
                return Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('\n');
              } catch (e) {
                return ''; // Safe cross-origin catch
              }
            }).join('\n')}
          </style>
        </head>
        <body class="iframe-print-body">
          <div class="printable-invoice">
            ${printContent}
          </div>
          <script>
            // Ensure images and fonts are loaded before printing
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

  const handleDownloadPDF = async () => {
    if (!printTargetInvoice) return;
    setDownloadingPDF(true);
    
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      const element = document.getElementById('invoice-print-area');
      if (!element) {
        alert('Invoice print area not found');
        return;
      }

      // Monkey-patch window.getComputedStyle to intercept oklch color values
      window.getComputedStyle = function(el, pseudo) {
        const style = originalGetComputedStyle.call(this, el, pseudo);
        return new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function(propertyName) {
                const val = target.getPropertyValue(propertyName);
                if (typeof val === 'string' && val.includes('oklch')) {
                  return oklchToRgbString(val);
                }
                return val;
              };
            }
            const val = Reflect.get(target, prop);
            if (typeof val === 'string' && val.includes('oklch')) {
              return oklchToRgbString(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };
      
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a5');
      const imgWidth = 148; 
      const pageHeight = 210;  
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`invoice_${printTargetInvoice.id.substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF download: ' + err.message + '\nStack: ' + err.stack);
    } finally {
      // Restore the original getComputedStyle API
      window.getComputedStyle = originalGetComputedStyle;
      setDownloadingPDF(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const pName = inv.patient?.name || '';
    return pName.toLowerCase().includes(invoiceSearch.toLowerCase()) || inv.id.includes(invoiceSearch);
  });

  const handleExportCSV = () => {
    const headers = [
      { key: 'id', label: 'Invoice ID' },
      { key: 'patient.name', label: 'Patient Name' },
      { key: 'patient.contact', label: 'Contact' },
      { key: 'patient.admission_status', label: 'Admission Status' },
      { key: 'total_amount', label: 'Total Amount' },
      { key: 'discount', label: 'Discount' },
      { key: 'insurance_covered', label: 'Insurance Covered' },
      { key: 'out_of_pocket_due', label: 'Out of Pocket Due' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created At' }
    ];
    exportToCSV(filteredInvoices, headers, 'hms_invoices');
  };

  return (
    <div className="space-y-6 animate-fadeIn relative">
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between no-print">
          <span>{error}</span>
          <button onClick={fetchData} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Screen Layout */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing Engine</h1>
          <p className="text-slate-500 text-sm mt-1">Manage invoice ledger generation, print receipts, and checkout payments.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-100 ${
              activeSubTab === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Invoices Ledger
          </button>
          <button
            onClick={() => {
              if (canWrite) {
                setActiveSubTab('create');
              } else {
                alert('Access Denied. Billing Clerks and Admins only.');
              }
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-100 ${
              !canWrite ? 'opacity-50 cursor-not-allowed' : ''
            } ${
              activeSubTab === 'create'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Generate Invoice
          </button>
        </div>
      </div>

      {activeSubTab === 'list' ? (
        // INVOICES LIST VIEW
        <div className="space-y-4 no-print">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search invoices by patient name or invoice ID..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
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

          {/* Table display */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading && invoices.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm">
                No invoices found in ledger logs.
              </div>
            ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6">Invoice ID</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Patient Name</th>
                    <th className="py-4 px-6">Total Amount</th>
                    <th className="py-4 px-6">Insurance Cover</th>
                    <th className="py-4 px-6">Patient Due</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono text-xs text-slate-500 truncate max-w-[120px]">{inv.id}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900">{inv.patient?.name || 'Unknown Patient'}</td>
                      <td className="py-4 px-6 font-semibold">₹{Number(inv.total_amount).toFixed(2)}</td>
                      <td className="py-4 px-6 text-slate-500">₹{Number(inv.insurance_covered).toFixed(2)}</td>
                      <td className={`py-4 px-6 font-bold ${inv.out_of_pocket_due > 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                        ₹{Number(inv.out_of_pocket_due).toFixed(2)}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handlePrint(inv)}
                          className="p-2 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition"
                          title="Print / PDF export"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {inv.status !== 'Paid' && (
                          <button
                            onClick={() => {
                              if (canWrite) {
                                handleOpenCheckout(inv);
                              } else {
                                alert('Access Denied. Billing Clerks and Admins only.');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg shadow-sm transition"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Checkout</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100 bg-white">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">ID: {inv.id.substring(0, 8)}...</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm mt-0.5">{inv.patient?.name || 'Unknown Patient'}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      inv.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Total Amount</span>
                      <span className="font-semibold text-slate-800">₹{Number(inv.total_amount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Insurance</span>
                      <span className="font-semibold text-slate-700">₹{Number(inv.insurance_covered).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Patient Due</span>
                      <span className={`font-bold ${inv.out_of_pocket_due > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                        ₹{Number(inv.out_of_pocket_due).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handlePrint(inv)}
                      className="p-2 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition"
                      title="Print / PDF export"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {inv.status !== 'Paid' && (
                      <button
                        onClick={() => {
                          if (canWrite) {
                            handleOpenCheckout(inv);
                          } else {
                            alert('Access Denied. Billing Clerks and Admins only.');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg shadow-sm transition"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Checkout</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
            )}
          </div>
        </div>
      ) : (
        // GENERATE INVOICE BUILDER
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          
          {/* Builder Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Select Patient Section */}
              <div className="flex gap-4 items-end">
                <div className="flex-1 relative">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Patient</label>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsPatientDropdownOpen(!isPatientDropdownOpen);
                      setPatientSearchQuery('');
                    }}
                    className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer bg-white flex justify-between items-center text-left"
                  >
                    {selectedPatient ? (
                      <span>
                        {selectedPatient.name} ({selectedPatient.admission_status} - Contact: {selectedPatient.contact})
                      </span>
                    ) : (
                      <span className="text-slate-400">Choose Patient...</span>
                    )}
                    <span className="text-slate-400 text-[10px]">▼</span>
                  </button>

                  {isPatientDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsPatientDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-250 rounded-xl shadow-xl z-20 p-2 space-y-2">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search patient by name or contact number..."
                            value={patientSearchQuery}
                            onChange={(e) => setPatientSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {(() => {
                            const filtered = patients.filter(p => 
                              p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
                              p.contact.includes(patientSearchQuery)
                            );
                            if (filtered.length === 0) {
                              return <div className="p-2 text-center text-slate-400 text-xs">No patients found</div>;
                            }
                            return filtered.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPatientId(p.id);
                                  setIsPatientDropdownOpen(false);
                                  setPatientSearchQuery('');
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col font-medium cursor-pointer"
                              >
                                <span className="text-slate-900">{p.name}</span>
                                <span className="text-[10px] text-slate-500">{p.admission_status} • Contact: {p.contact}</span>
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(true)}
                  className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold p-2.5 rounded-xl transition flex items-center gap-1.5 text-sm"
                  title="Add Patient"
                >
                  <UserPlus className="w-4 h-4 text-slate-500" />
                  <span>New Patient</span>
                </button>
              </div>

              {/* Select Doctor Section */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Doctor Assigned</label>
                <select
                  value={selectedDoctorName}
                  onChange={(e) => setSelectedDoctorName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer bg-white"
                >
                  <option value="">No Doctor Assigned (Pharmacy / Self-Purchase)</option>
                  <option value="Dr.Kannappan M.B.B.S,M.S">Dr.Kannappan M.B.B.S,M.S</option>
                  <option value="Dr.Suriya M.B.B.S">Dr.Suriya M.B.B.S</option>
                  <option value="Dr.Kannappan M.B.B.S,M.S & Dr.Suriya M.B.B.S">Dr.Kannappan M.B.B.S,M.S & Dr.Suriya M.B.B.S</option>
                </select>
              </div>

              {/* Bill Items Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bill Items</label>
                  <button
                    onClick={addBillItemLine}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Charge Row</span>
                  </button>
                </div>

                {billItems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    No charges added yet. Click "Add Charge Row" to start adding charges.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {billItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                        
                        {/* Item Type */}
                        <div className="w-full sm:w-32">
                          <select
                            value={item.item_type}
                            onChange={(e) => updateBillItemLine(idx, { 
                              item_type: e.target.value, 
                              item_id: '', 
                              unit_price: 0 
                            })}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white cursor-pointer"
                          >
                            <option value="Inventory">Pharma/Drug</option>
                            <option value="Service">Consult/Lab</option>
                            <option value="Room">Bed/Room</option>
                          </select>
                        </div>

                        {/* Item Dropdown or Text */}
                        <div className="flex-1 w-full relative">
                          {item.item_type === 'Inventory' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (openDropdownIdx === idx) {
                                    setOpenDropdownIdx(null);
                                  } else {
                                    setOpenDropdownIdx(idx);
                                    setDrugSearchQuery('');
                                  }
                                }}
                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-left flex justify-between items-center cursor-pointer shadow-sm focus:ring-1 focus:ring-emerald-500"
                              >
                                {item.item_id ? (
                                  (() => {
                                    const selectedInv = inventory.find(inv => inv.id === item.item_id);
                                    return selectedInv ? (
                                      <span className="font-semibold text-slate-800">
                                        {selectedInv.item_name} (Price: ₹{Number(selectedInv.unit_price).toFixed(2)})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Select Drug...</span>
                                    );
                                  })()
                                ) : (
                                  <span className="text-slate-400">Select Drug...</span>
                                )}
                                <span className="text-slate-400 text-[10px]">▼</span>
                              </button>
                              
                              {openDropdownIdx === idx && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownIdx(null)} />
                                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-250 rounded-xl shadow-xl z-25 p-2 space-y-2">
                                    <input
                                      type="text"
                                      placeholder="Search drug by name..."
                                      value={drugSearchQuery}
                                      onChange={(e) => setDrugSearchQuery(e.target.value)}
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                      autoFocus
                                    />
                                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                                      {(() => {
                                        const filtered = inventory.filter(inv => 
                                          inv.item_name.toLowerCase().includes(drugSearchQuery.toLowerCase())
                                        );
                                        if (filtered.length === 0) {
                                          return <div className="p-2 text-center text-slate-400 text-xs">No drugs found</div>;
                                        }
                                        return filtered.map(inv => (
                                          <button
                                            key={inv.id}
                                            type="button"
                                            disabled={inv.current_stock === 0}
                                            onClick={() => {
                                              updateBillItemLine(idx, { item_id: inv.id });
                                              setOpenDropdownIdx(null);
                                            }}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent flex justify-between font-medium cursor-pointer"
                                          >
                                            <span>{inv.item_name}</span>
                                            <span className="text-slate-400 text-[10px]">
                                              ₹{Number(inv.unit_price).toFixed(2)} | Avail: {inv.current_stock}
                                            </span>
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <input
                              type="text"
                              placeholder={item.item_type === 'Room' ? 'General Ward Bed / ICU' : 'Doctor consulting fee / CT Scan'}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                            />
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateBillItemLine(idx, { quantity: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center bg-white"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => updateBillItemLine(idx, { unit_price: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-right bg-white"
                            placeholder="Price"
                            disabled={item.item_type === 'Inventory' && !!item.item_id} // Lock inventory item price to catalog level
                          />
                        </div>

                        {/* Subtotal preview */}
                        <div className="w-24 text-right text-xs font-bold text-slate-800 self-center hidden sm:block">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeBillItemLine(idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition"
                          title="Remove item row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Pricing Ledger Summaries */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 self-start">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <span>Invoice Calculator</span>
            </h3>

            <div className="space-y-4">
              {/* Calculations readout */}
              <div className="text-xs space-y-2.5">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Item Subtotal:</span>
                  <span className="font-semibold text-slate-800">₹{getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Flat VAT Tax (10%):</span>
                  <span className="font-semibold text-slate-800">₹{getTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-2.5">
                  <span>Total Gross (with Tax):</span>
                  <span>₹{getGrossTotal().toFixed(2)}</span>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Adjustments inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applied Discount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Insurance Covered (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={insuranceCovered}
                    onChange={(e) => setInsuranceCovered(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Net totals output */}
              <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Net Payable</span>
                  <p className="text-2xl font-bold text-emerald-700 mt-0.5">₹{getPatientDue().toFixed(2)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={handleGenerateInvoice}
                  disabled={billItems.length === 0 || !selectedPatientId}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  Generate Invoice & Reduce Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId('');
                    setDiscount(0);
                    setInsuranceCovered(0);
                    setBillItems([]);
                    setPatientSearchQuery('');
                    setActiveSubTab('list');
                  }}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs text-center border border-slate-200 hover:bg-slate-50 rounded-xl font-semibold transition"
                >
                  Cancel & Reset
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Checkout Payment Modal */}
      {checkoutInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <span>Invoice Checkout</span>
              </h3>
              <button onClick={() => setCheckoutInvoice(null)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleProcessCheckout} className="p-6 space-y-4">
              {checkoutError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Patient Name:</span>
                  <span className="font-semibold text-slate-800">{checkoutInvoice.patient?.name}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Grand Total amount:</span>
                  <span className="font-semibold text-slate-800">₹{Number(checkoutInvoice.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 border-t border-slate-200/50 pt-2 font-bold text-slate-900">
                  <span>Total Due:</span>
                  <span>₹{Number(checkoutInvoice.out_of_pocket_due).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Mode</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['Cash', 'Card', 'UPI'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 px-3 border text-xs font-bold rounded-xl transition ${
                        paymentMode === mode 
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(checkoutInvoice.out_of_pocket_due)}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reference / Receipt Number</label>
                <input
                  type="text"
                  placeholder="e.g. Card TX ID or UPI Ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCheckoutInvoice(null)}
                  className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Patient Add Modal */}
      {isPatientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-500" />
                <span>Register Patient Record</span>
              </h3>
              <button onClick={() => setIsPatientModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePatient} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Full Name</label>
                <input
                  type="text"
                  required
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Gender</label>
                  <select
                    value={newPatientGender}
                    onChange={(e) => setNewPatientGender(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 cursor-pointer focus:outline-none bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={newPatientContact}
                  onChange={(e) => setNewPatientContact(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none"
                  placeholder="e.g. +1 555-0100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Admission Status</label>
                <select
                  value={newPatientAdmission}
                  onChange={(e) => setNewPatientAdmission(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 cursor-pointer focus:outline-none bg-white"
                >
                  <option value="Inpatient">Inpatient</option>
                  <option value="Outpatient">Outpatient</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {isPrintPreviewOpen && printTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn no-print">
          <div className="bg-white rounded-2xl w-full max-w-4xl border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-500" />
                <span>Invoice Print Preview</span>
              </h3>
              <button 
                onClick={() => {
                  setIsPrintPreviewOpen(false);
                  setPrintTargetInvoice(null);
                }} 
                className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500"
              >
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable invoice container */}
            <div className="overflow-auto p-6 flex-1 bg-slate-50">
              <div id="invoice-print-area" className="printable-invoice bg-white border border-slate-200 rounded-2xl shadow-sm p-[10mm] w-[148mm] h-[210mm] mx-auto space-y-4 text-slate-800 relative flex flex-col justify-between box-border text-[11px]">
                
                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0">
                  <div className="text-center">
                    <img src="/logo.png" alt="Watermark Logo" className="w-60 h-60 object-contain mx-auto" style={{ imageRendering: '-webkit-optimize-contrast' }} />
                    <h2 className="text-xl font-black tracking-widest mt-2 text-slate-900 uppercase">AMUDHA HOSPITAL</h2>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {/* Print Template Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <img src="/logo.png" alt="Amudha Hospital Logo" className="w-10 h-10 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' }} />
                      <div>
                        <h1 className="text-lg font-black text-[#00b887] tracking-tight leading-none uppercase">AMUDHA HOSPITAL</h1>
                        <p className="text-[9px] text-slate-700 font-bold mt-1">Dr. Kannappan M.B.B.S, M.S. &nbsp;&bull;&nbsp; Dr. Suriya M.B.B.S.</p>
                        <p className="text-[8px] text-slate-500 font-medium mt-0.5">Salem Main Road, Thandrampet</p>
                      </div>
                    </div>
                    <div className="text-right text-[10px] space-y-0.5">
                      <p className="text-slate-500"><span className="font-bold text-slate-700">Invoice:</span> #{printTargetInvoice.id.substring(0, 12).toUpperCase()}</p>
                      <p className="text-slate-500"><span className="font-bold text-slate-700">Date:</span> {new Date(printTargetInvoice.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="text-[10px] space-y-0.5">
                    <h3 className="font-black text-slate-850 tracking-wide">INVOICE TO:</h3>
                    <p className="font-bold text-slate-900">{printTargetInvoice.patient?.name}</p>
                    <div className="text-slate-550 space-y-0.5 font-medium flex flex-wrap gap-x-4 gap-y-0.5">
                      <p>Age/Sex: {printTargetInvoice.patient?.age} Yrs / {printTargetInvoice.patient?.gender}</p>
                      <p>Contact: {printTargetInvoice.patient?.contact}</p>
                      <p>Status: {printTargetInvoice.patient?.admission_status}</p>
                      {printTargetInvoice.doctor_name && (
                        <p className="text-[#00b887] font-semibold"><span className="font-bold text-slate-700">Doctor:</span> {printTargetInvoice.doctor_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Invoice Items table */}
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-[#00b887] text-white font-bold">
                        <th className="py-1.5 px-3 rounded-l-lg">DESCRIPTION</th>
                        <th className="py-1.5 px-3 text-center">QTY</th>
                        <th className="py-1.5 px-3 text-center">PRICE</th>
                        <th className="py-1.5 px-3 text-right rounded-r-lg">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {printTargetInvoice.items.map((item, index) => {
                        let name = 'Custom Service / Consultation';
                        if (item.item_type === 'Inventory' && item.item_id) {
                          const invItem = inventory.find(i => i.id === item.item_id);
                          name = invItem?.item_name || 'Medicine Product';
                        } else if (item.item_type === 'Room') {
                          name = 'Ward Bed Stay Charges';
                        } else if (item.item_type === 'Service') {
                          name = 'Medical Consultation / Lab Fee';
                        }
                        return (
                          <tr key={index}>
                            <td className="py-1.5 px-3">
                              <span className="font-semibold text-slate-900 block">{item.item_type}</span>
                              <span className="text-[9px] text-slate-500">{name}</span>
                            </td>
                            <td className="py-1.5 px-3 text-center font-semibold">{item.quantity}</td>
                            <td className="py-1.5 px-3 text-center">₹{Number(item.unit_price).toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">₹{Number(item.subtotal).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Spacer to push summaries to the bottom */}
                <div className="flex-1"></div>

                {/* Invoice summaries and signature block */}
                <div className="relative z-10">
                  <div className="border-t border-slate-150 pt-3 grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-between text-[9px] text-slate-400 space-y-2">
                      <div>
                        <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[7px]">Terms & Declarations</h5>
                        <p className="mt-0.5 leading-normal">
                          This is a formal digital invoice receipt generated by the Amudha Hospital billing desk. Outpatients are requested to clear all dues.
                        </p>
                      </div>
                      <div className="border-t border-dashed border-slate-250 pt-2 w-32 text-center self-start">
                        <div className="h-6"></div>
                        <div className="font-semibold text-slate-800 text-[8px] uppercase tracking-wider">Cashier / Accountant</div>
                        <div className="text-[7px] text-slate-400 mt-0.5">Stamp & Authorized Sign</div>
                      </div>
                    </div>

                    <div className="w-44 ml-auto text-[10px] space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Gross Item Total:</span>
                        <span>₹{(Number(printTargetInvoice.total_amount) / 1.1).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>VAT Tax (10%):</span>
                        <span>₹{(Number(printTargetInvoice.total_amount) - (Number(printTargetInvoice.total_amount) / 1.1)).toFixed(2)}</span>
                      </div>
                      
                      {Number(printTargetInvoice.discount) > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Applied Discount:</span>
                          <span className="text-red-500">-₹{Number(printTargetInvoice.discount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(printTargetInvoice.insurance_covered) > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>Insurance Coverage:</span>
                          <span className="text-emerald-600">-₹{Number(printTargetInvoice.insurance_covered).toFixed(2)}</span>
                        </div>
                      )}

                      {/* TOTAL Bar representing grand total amount */}
                      <div className="bg-[#00b887] text-white font-bold p-2 rounded-lg flex justify-between items-center text-xs shadow-sm">
                        <span>TOTAL:</span>
                        <span>₹{Number(printTargetInvoice.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Wave decoration matching user template */}
                <div className="w-full mt-auto pt-3 border-t border-slate-100 relative z-10">
                  <svg viewBox="0 0 1440 120" className="w-full h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 60C120 30 360 -30 720 30C1080 90 1320 120 1440 90V120H0V60Z" fill="#00b887" />
                    <path d="M0 90C240 60 480 60 720 90C960 120 1200 120 1440 90V120H0V90Z" fill="#5eead4" opacity="0.4" />
                  </svg>
                  <div className="text-center text-[9px] text-slate-400 tracking-wide font-medium mt-2">
                    Thank you for trusting Amudha Hospital. Wellness is our priority.
                  </div>
                </div>

              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsPrintPreviewOpen(false);
                  setPrintTargetInvoice(null);
                }}
                className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={downloadingPDF}
                onClick={handleDownloadPDF}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {downloadingPDF ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={printInvoiceContent}
                className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
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
