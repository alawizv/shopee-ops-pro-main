import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

import { AlertCircle } from 'lucide-react';
import MultiFileUploader from '../components/shared/MultiFileUploader';
import StatsCard from '../components/shared/StatsCard';
import ProcessingProgress from '../components/shared/ProcessingProgress';
import OutputFilesList from '../components/shared/OutputFilesList';
import { toast } from 'sonner';
import { DollarSign, TrendingDown, Zap, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// Inline file parser for Income files (skip first 5 rows, header at row 6)
async function parseIncomeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheets = workbook.SheetNames;
        
        // Always use "Income" sheet
        const targetSheet = sheets.includes('Income') ? 'Income' : sheets[0];
        const worksheet = workbook.Sheets[targetSheet];
        
        // Parse with header at row 6 (index 5 in 0-based)
        // Skip first 5 rows (metadata)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: null, 
          raw: false,
          range: 5  // Start from row 6 (0-based index 5)
        });
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Format file tidak sesuai. Header harus berada di baris ke-6.'));
          return;
        }
        
        resolve({ data: jsonData, sheets: sheets });
      } catch (error) {
        reject(new Error('Error parsing file: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsBinaryString(file);
  });
}

// Parse Rupiah - handles Indonesian currency format
function parseRupiah(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);
  
  let str = String(value).trim();
  str = str.replace(/Rp\.?/g, '').replace(/\s/g, '');
  str = str.replace(/\./g, '');
  str = str.replace(/,.*$/, '');
  
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

// Column aliases for flexible matching
const COLUMN_ALIASES = {
  'No. Pesanan': ['No. Pesanan', 'No Pesanan'],
  'Tanggal Dana Dilepaskan': ['Tanggal Dana Dilepaskan', 'Tanggal Dana', 'Tanggal Pelepasan Dana'],
  'Total Penghasilan': ['Total Penghasilan', 'Total Penghasilan (Rp)'],
  'Biaya Komisi AMS': ['Biaya Komisi AMS', 'Komisi AMS', 'AMS']
};

// Find column name from aliases
function findColumn(row, aliases) {
  for (const alias of aliases) {
    if (row.hasOwnProperty(alias)) return alias;
  }
  return null;
}

// Inline income processor
function processShopeeIncome(rawData) {
  const PLATFORM_FEE_COLUMNS = [
    'Ongkos Kirim Pengembalian Barang', 
    'Kembali ke Biaya Pengiriman Pengirim', 
    'Pengembalian Biaya Kirim', 
    'Biaya Administrasi (termasuk PPN 11%)', 
    'Biaya Layanan', 
    'Biaya Proses Pesanan', 
    'Premi', 
    'Biaya Program Hemat Biaya Kirim', 
    'Biaya Transaksi', 
    'Biaya Kampanye', 
    'Bea Masuk, PPN & PPh', 
    'Biaya Isi Saldo Otomatis (dari Penghasilan)'
  ];
  
  // Find actual column names using aliases
  const firstRow = rawData[0] || {};
  const columnMap = {};
  const missingColumns = [];
  
  for (const [standardName, aliases] of Object.entries(COLUMN_ALIASES)) {
    const actualColumn = findColumn(firstRow, aliases);
    if (actualColumn) {
      columnMap[standardName] = actualColumn;
    } else {
      missingColumns.push(standardName);
    }
  }
  
  if (missingColumns.length > 0) {
    throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(', ')}`);
  }
  
  const stats = { total_orders: rawData.length, total_platform_fee: 0, total_ams: 0, total_income: 0 };
  const processedRows = rawData.map(row => {
    let platformFee = 0;
    PLATFORM_FEE_COLUMNS.forEach(col => {
      if (row[col] !== undefined && row[col] !== null) {
        platformFee += Math.abs(parseRupiah(row[col]));
      }
    });
    
    const amsFee = Math.abs(parseRupiah(row[columnMap['Biaya Komisi AMS']]));
    const totalIncome = parseRupiah(row[columnMap['Total Penghasilan']]);
    
    stats.total_platform_fee += platformFee;
    stats.total_ams += amsFee;
    stats.total_income += totalIncome;
    
    return {
      'No. Pesanan': row[columnMap['No. Pesanan']], 
      'Tanggal Dana Dilepaskan': row[columnMap['Tanggal Dana Dilepaskan']],
      'Biaya Platform': platformFee, 
      'Biaya Komisi AMS': amsFee,
      'Total Penghasilan': totalIncome
    };
  });
  
  return { data: processedRows, stats };
}

export default function ShopeePencairan() {
  const [files, setFiles] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  const queryClient = useQueryClient();
  
  const handleFilesSelect = (selectedFiles) => {
    setFiles(selectedFiles);
    setProcessedData(null);
    setError(null);
  };
  
  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };
  
  const handleProcess = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    setProgress({ current: 0, total: files.length });
    
    try {
      // Collect all data from all files
      let allRawData = [];
      const fileNames = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });
        
        const { data: rawData } = await parseIncomeFile(file);
        if (rawData && rawData.length > 0) {
          allRawData = allRawData.concat(rawData);
          fileNames.push(file.name);
        }
      }
      
      if (allRawData.length === 0) {
        throw new Error('Semua file kosong atau tidak valid');
      }
      
      // Process combined income
      const { data: outputData, stats } = processShopeeIncome(allRawData);
      
      // Generate CSV
      const csv = Papa.unparse(outputData, { quotes: true, delimiter: ",", header: true });
      const csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const csvFile = new File([csvBlob], `income_combined_${Date.now()}.csv`, { type: 'text/csv' });
      const { file_url: csvUrl } = await base44.integrations.Core.UploadFile({ file: csvFile });
      
      // Generate Excel
      const ws = XLSX.utils.json_to_sheet(outputData, { cellDates: false, raw: true });
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) continue;
          ws[cellAddress].z = '@';
        }
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Income');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `income_combined_${Date.now()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const { file_url: excelUrl } = await base44.integrations.Core.UploadFile({ file: excelFile });
      
      // Create file record with TTL
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await base44.entities.ProcessedFile.create({
        file_type: 'income',
        original_filename: fileNames.join(' + '),
        raw_file_url: '',
        output_csv_url: csvUrl,
        output_excel_url: excelUrl,
        expires_at: expiresAt.toISOString(),
        stats: stats,
        status: 'completed'
      });
      
      setProcessedData(outputData);
      setFiles([]);
      queryClient.invalidateQueries(['processedFiles']);
      
      toast.success(`Berhasil! ${stats.total_orders} order diproses dari ${files.length} file`);
      
    } catch (err) {
      setError(err.message);
      toast.error('Gagal memproses file: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };
  

  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value || 0);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Pencairan Shopee (Income)</h1>
          <p className="text-slate-600">Upload file pencairan Shopee untuk diproses (Dana Dilepaskan)</p>
        </div>
        
        {/* File Uploader */}
        <MultiFileUploader 
          files={files}
          onFilesSelect={handleFilesSelect}
          onRemoveFile={handleRemoveFile}
          accept=".xlsx"
          maxFiles={10}
          disabled={isProcessing}
        />

        {/* Action Button */}
        {files.length > 0 && !processedData && (
          <div className="flex justify-center">
            <Button 
              onClick={handleProcess}
              disabled={isProcessing}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
            >
              {isProcessing ? 'Memproses...' : 'Process'}
            </Button>
          </div>
        )}
        
        {/* Processing Progress */}
        {isProcessing && (
          <ProcessingProgress 
            message={progress.total > 1 
              ? `Memproses file ${progress.current}/${progress.total}...` 
              : "Memproses file income Shopee..."
            } 
          />
        )}
        
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error Processing File</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}
        
        {/* Output Files List */}
        <OutputFilesList />
      </div>
    </div>
  );
}