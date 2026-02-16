import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

export default function DownloadButtons({ data, filename, sheetName = "Data", disabled = false }) {
  const downloadCSV = () => {
    const csv = Papa.unparse(data, {
      quotes: true,
      delimiter: ",",
      header: true
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  };
  
  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data, { cellDates: false, raw: true });
    
    // Set all cells to text format to prevent Excel auto-formatting
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].z = '@'; // Force text format
      }
    }
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };
  
  if (!data || data.length === 0) {
    return null;
  }
  
  return (
    <div className="flex gap-3">
      <Button 
        onClick={downloadCSV} 
        disabled={disabled}
        variant="outline"
        className="gap-2 border-slate-300 hover:bg-slate-50"
      >
        <FileText className="w-4 h-4" />
        Download CSV
      </Button>
      <Button 
        onClick={downloadExcel} 
        disabled={disabled}
        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Download Excel
      </Button>
    </div>
  );
}