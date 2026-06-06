/**
 * Utility function to export JSON data to a downloadable CSV file.
 * Handles escaping quotes and handles comma formatting.
 */
export const exportToCSV = (data, headers, filename) => {
  const csvRows = [];
  
  // 1. Add headers row
  csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(','));
  
  // 2. Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      // Handle nested properties if key contains dots (e.g. 'patient.name')
      let val = row;
      const keys = header.key.split('.');
      for (const k of keys) {
        if (val === null || val === undefined) break;
        val = val[k];
      }
      
      if (val === null || val === undefined) return '""';
      const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  // 3. Trigger file download
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
