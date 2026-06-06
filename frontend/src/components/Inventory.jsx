import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  AlertCircle, 
  CalendarClock,
  Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';

export const Inventory = () => {
  const { apiFetch, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search/Filter states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  
  // Form states
  const [editingItem, setEditingItem] = useState(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Pharma');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [currentStock, setCurrentStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0.00);
  const [supplierInfo, setSupplierInfo] = useState('');
  
  // Dispense Form states
  const [dispenseItem, setDispenseItem] = useState(null);
  const [dispenseQty, setDispenseQty] = useState(1);

  // Check role permission
  const canModify = user?.role === 'Admin' || user?.role === 'Pharmacist';

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:8000/api/inventory?q=${encodeURIComponent(search)}${categoryFilter ? `&category=${categoryFilter}` : ''}`;
      const data = await apiFetch(url);
      setItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [search, categoryFilter]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemName('');
    setCategory('Pharma');
    setBatchNumber('');
    setExpiryDate('');
    setCurrentStock(0);
    setReorderLevel(0);
    setUnitPrice(0.00);
    setSupplierInfo('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemName(item.item_name);
    setCategory(item.category);
    setBatchNumber(item.batch_number);
    setExpiryDate(item.expiry_date);
    setCurrentStock(item.current_stock);
    setReorderLevel(item.reorder_level);
    setUnitPrice(Number(item.unit_price));
    setSupplierInfo(item.supplier_info || '');
    setIsModalOpen(true);
  };

  const handleOpenDispenseModal = (item) => {
    setDispenseItem(item);
    setDispenseQty(1);
    setIsDispenseModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName || !batchNumber || !expiryDate) return;

    const payload = {
      item_name: itemName,
      category,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      current_stock: Number(currentStock),
      reorder_level: Number(reorderLevel),
      unit_price: Number(unitPrice),
      supplier_info: supplierInfo || null
    };

    try {
      if (editingItem) {
        await apiFetch(`http://localhost:8000/api/inventory/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('http://localhost:8000/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setIsModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Error saving item');
    }
  };

  const handleDispenseItem = async (e) => {
    e.preventDefault();
    if (!dispenseItem) return;

    try {
      await apiFetch(`http://localhost:8000/api/inventory/${dispenseItem.id}/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(dispenseQty) })
      });
      setIsDispenseModalOpen(false);
      fetchInventory();
    } catch (err) {
      alert(err.message || 'Error dispensing item');
    }
  };

  // Helper check for low stock
  const isLowStock = (item) => {
    return item.current_stock <= item.reorder_level;
  };

  // Helper check for expiration
  const isExpiringSoon = (expiryStr) => {
    const expiry = new Date(expiryStr);
    const today = new Date("2026-06-03"); // Match metadata date
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  const handleExportCSV = () => {
    const headers = [
      { key: 'item_name', label: 'Item Name' },
      { key: 'category', label: 'Category' },
      { key: 'batch_number', label: 'Batch Number' },
      { key: 'expiry_date', label: 'Expiry Date' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'reorder_level', label: 'Reorder Level' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'supplier_info', label: 'Supplier Info' }
    ];
    exportToCSV(items, headers, 'hms_inventory');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Catalog</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and track pharma, surgical, and consumable products.</p>
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
          {canModify && (
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 shadow-sm transition active:scale-95 duration-100"
            >
              <Plus className="w-4 h-4" />
              <span>Add Catalog Item</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchInventory} className="underline font-semibold hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by item name or batch number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm transition"
          />
        </div>
        {/* Category select */}
        <div className="relative w-full sm:w-48">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Filter className="w-4 h-4" />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="Pharma">Pharma</option>
            <option value="Surgical">Surgical</option>
            <option value="Consumable">Consumable</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            No items found matching the search criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-4 px-6">Item Name</th>
                    <th className="py-4 px-6">Category</th>
                    <th className="py-4 px-6">Batch Number</th>
                    <th className="py-4 px-6">Expiry Date</th>
                    <th className="py-4 px-6">Stock / Reorder</th>
                    <th className="py-4 px-6">Unit Price</th>
                    <th className="py-4 px-6 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.map((item) => {
                    const isLow = isLowStock(item);
                    const isExp = isExpiringSoon(item.expiry_date);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {item.item_name}
                            {isLow && (
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Low Stock
                              </span>
                            )}
                            {isExp && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
                                <CalendarClock className="w-3.5 h-3.5" />
                                Expiring Soon
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">{item.batch_number}</td>
                        <td className={`py-4 px-6 ${isExp ? 'text-amber-600 font-semibold' : ''}`}>
                          {item.expiry_date}
                        </td>
                        <td className="py-4 px-6">
                          <span className={isLow ? 'text-red-600 font-semibold' : 'text-slate-900'}>
                            {item.current_stock}
                          </span>
                          <span className="text-slate-400 font-normal"> / {item.reorder_level}</span>
                        </td>
                        <td className="py-4 px-6 font-semibold">₹{Number(item.unit_price).toFixed(2)}</td>
                        <td className="py-4 px-6 text-right space-x-2 no-print">
                          {canModify ? (
                            <>
                              <button
                                onClick={() => handleOpenDispenseModal(item)}
                                disabled={item.current_stock === 0}
                                className="text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-150 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 px-3 py-1.5 rounded-lg transition"
                              >
                                Dispense
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition"
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Read-only Lookup</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const isLow = isLowStock(item);
                const isExp = isExpiringSoon(item.expiry_date);
                return (
                  <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm flex flex-wrap items-center gap-1.5">
                          {item.item_name}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                          Batch: {item.batch_number}
                        </span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg flex-shrink-0">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {isLow && (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-100">
                          Low Stock
                        </span>
                      )}
                      {isExp && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
                          Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Expiry</span>
                        <span className={`font-semibold ${isExp ? 'text-amber-600' : 'text-slate-700'}`}>{item.expiry_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Stock/Reorder</span>
                        <span className="font-semibold">
                          <span className={isLow ? 'text-red-600' : 'text-slate-900'}>{item.current_stock}</span>
                          <span className="text-slate-400 font-normal"> / {item.reorder_level}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Price</span>
                        <span className="font-semibold text-slate-800">₹{Number(item.unit_price).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      {canModify ? (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => handleOpenDispenseModal(item)}
                            disabled={item.current_stock === 0}
                            className="flex-1 sm:flex-initial text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-150 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 px-3 py-1.5 rounded-lg transition"
                          >
                            Dispense
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="flex-1 sm:flex-initial text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Read-only Lookup</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* CRUD Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-950">
                {editingItem ? 'Edit Inventory Catalog' : 'Add Catalog Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="e.g. Paracetamol 500mg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer"
                  >
                    <option value="Pharma">Pharma</option>
                    <option value="Surgical">Surgical</option>
                    <option value="Consumable">Consumable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="e.g. PM88123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                    className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Info</label>
                <input
                  type="text"
                  value={supplierInfo}
                  onChange={(e) => setSupplierInfo(e.target.value)}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="e.g. Apex Pharmaceuticals"
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
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Quantity Modal */}
      {isDispenseModalOpen && dispenseItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 overflow-hidden shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-950">Dispense Medicine</h3>
              <button onClick={() => setIsDispenseModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition text-slate-500">
                <XCloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleDispenseItem} className="p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-500">
                  Deduct quantity for <strong className="text-slate-900">{dispenseItem.item_name}</strong> (Batch: {dispenseItem.batch_number}).
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mt-3 flex justify-between text-xs text-slate-500">
                  <span>Available stock:</span>
                  <span className="font-semibold text-slate-900">{dispenseItem.current_stock} units</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Dispense Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={dispenseItem.current_stock}
                  required
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(Number(e.target.value))}
                  className="mt-1 w-full px-3.5 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispenseModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition"
                >
                  Confirm Dispense
                </button>
              </div>
            </form>
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
