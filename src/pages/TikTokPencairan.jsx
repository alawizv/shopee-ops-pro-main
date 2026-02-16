import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import MultiFileUploader from '../components/shared/MultiFileUploader';
import ProcessingProgress from '../components/shared/ProcessingProgress';
import OutputFilesList from '../components/shared/OutputFilesList';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

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

// Parse TikTok Income file - read header from Row 1 directly
async function parseTikTokIncomeFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        
        if (file.name.endsWith('.csv')) {
          // For CSV
          const result = Papa.parse(data, { header: false, skipEmptyLines: false });
          const rows = result.data;
          
          console.log('CSV Total rows:', rows.length);
          
          if (rows.length < 2) {
            reject(new Error('File CSV kosong atau hanya memiliki header'));
            return;
          }
          
          // Row 0 = Header, Row 1+ = Data
          const headerRow = rows[0];
          const dataRows = rows.slice(1);
          
          console.log('Headers from Row 1:', headerRow);
          console.log('Data rows count:', dataRows.length);
          
          const jsonData = dataRows
            .filter(row => row && row.length > 0 && row.some(cell => cell && String(cell).trim() !== ''))
            .map(row => {
              const obj = {};
              headerRow.forEach((header, idx) => {
                obj[String(header || '').trim()] = row[idx] || null;
              });
              return obj;
            });
          
          console.log('Parsed data count:', jsonData.length);
          if (jsonData.length > 0) console.log('Sample data:', jsonData[0]);
          
          resolve({ data: jsonData });
          
        } else {
          // For Excel
          const workbook = XLSX.read(data, { type: 'binary' });
          const allSheets = workbook.SheetNames;
          console.log('All sheets:', allSheets);
          
          // Prioritize "Order details" sheet
          let targetSheet = null;
          const preferredSheets = ['Order details', 'order details', 'Order Details'];
          
          for (const preferred of preferredSheets) {
            const found = allSheets.find(s => s.toLowerCase() === preferred.toLowerCase());
            if (found) {
              targetSheet = found;
              break;
            }
          }
          
          // Fallback to first sheet if no preferred sheet found
          const sheetName = targetSheet || allSheets[0];
          const worksheet = workbook.Sheets[sheetName];
          
          console.log('Using sheet:', sheetName);
          
          // Get raw data as array of arrays (header: 1 means no auto-header)
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });
          
          console.log('Excel Total rows:', rawData.length);
          
          if (rawData.length < 2) {
            reject(new Error(`Sheet "${sheetName}" kosong atau hanya memiliki header`));
            return;
          }
          
          // Row 0 = Header (index 0), Row 1+ = Data
          const headerRow = rawData[0];
          const dataRows = rawData.slice(1);
          
          console.log('Headers from Row 1:', headerRow);
          console.log('Total data rows:', dataRows.length);
          console.log('Sample raw rows:', dataRows.slice(0, 3));
          
          const jsonData = [];
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            // Skip completely empty rows
            if (!row || row.length === 0) continue;
            
            // Check if row has at least one non-empty cell
            const hasData = row.some(cell => {
              if (cell === null || cell === undefined) return false;
              const str = String(cell).trim();
              return str !== '';
            });
            
            if (!hasData) continue;
            
            // Map row to object using headers
            const obj = {};
            headerRow.forEach((header, idx) => {
              const value = row[idx];
              const headerName = String(header || '').trim();
              if (headerName) {
                obj[headerName] = value !== undefined && value !== null ? value : null;
              }
            });
            
            jsonData.push(obj);
          }
          
          console.log('Parsed data count:', jsonData.length);
          console.log('Filtered out:', dataRows.length - jsonData.length, 'empty rows');
          if (jsonData.length > 0) {
            console.log('First 3 rows:', jsonData.slice(0, 3));
            console.log('Last row:', jsonData[jsonData.length - 1]);
          }
          
          if (jsonData.length === 0) {
            reject(new Error(`Sheet "${sheetName}" tidak memiliki data. Total baris: ${dataRows.length}.`));
            return;
          }
          
          resolve({ data: jsonData });
        }
      } catch (error) {
        console.error('Parse error:', error);
        reject(new Error('Error parsing file: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

// Find column by name (case-insensitive)
function findColumn(row, aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
    if (found) return found;
  }
  return null;
}

// Process TikTok Income
function processTikTokIncome(rawData) {
  console.log('Processing TikTok Income, total rows:', rawData.length);
  if (rawData.length > 0) {
    console.log('Available columns:', Object.keys(rawData[0]));
  }
  
  const REQUIRED_COLUMNS = {
    'Order/adjustment ID': ['Order/adjustment ID', 'Order ID', 'Adjustment ID', 'Order / Adjustment ID'],
    'Order settled time': ['Order settled time', 'Settled time', 'Settlement time', 'Order Settled Time'],
    'Total Fees': ['Total Fees', 'Total fees', 'Total Fee'],
    'Total settlement amount': ['Total settlement amount', 'Settlement amount', 'Total Settlement Amount', 'Settlement Amount']
  };
  
  const AFFILIATE_COLUMNS = [
    'Affiliate Commission',
    'Affiliate partner commission',
    'Affiliate Shop Ads commission',
    'Affiliate Partner shop ads commission'
  ];
  
  // Find actual column names
  const firstRow = rawData[0] || {};
  const columnMap = {};
  const missingColumns = [];
  
  for (const [standardName, aliases] of Object.entries(REQUIRED_COLUMNS)) {
    const actualColumn = findColumn(firstRow, aliases);
    if (actualColumn) {
      columnMap[standardName] = actualColumn;
      console.log(`Mapped ${standardName} -> ${actualColumn}`);
    } else {
      missingColumns.push(standardName);
    }
  }
  
  if (missingColumns.length > 0) {
    const availableColumns = Object.keys(firstRow).slice(0, 10).join(', ');
    throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(', ')}\n\nKolom yang tersedia: ${availableColumns}`);
  }
  
  // Find affiliate columns (optional)
  const affiliateColumnMap = {};
  AFFILIATE_COLUMNS.forEach(col => {
    const found = findColumn(firstRow, [col]);
    if (found) {
      affiliateColumnMap[col] = found;
    }
  });
  
  const stats = { 
    total_orders: rawData.length, 
    total_platform_fee: 0, 
    total_ams: 0, 
    total_income: 0 
  };
  
  const processedRows = rawData.map(row => {
    // Calculate affiliate commission sum (ABS of each field)
    let affiliateSum = 0;
    Object.values(affiliateColumnMap).forEach(colName => {
      if (row[colName] !== undefined && row[colName] !== null) {
        affiliateSum += Math.abs(parseRupiah(row[colName]));
      }
    });
    
    // Get total fees (parse)
    const totalFees = Math.abs(parseRupiah(row[columnMap['Total Fees']]));
    
    // Calculate platform fee: ABS(Total Fees - Affiliate Sum)
    const platformFee = Math.abs(totalFees - affiliateSum);
    
    // Get total settlement amount (parse + ABS)
    const totalIncome = Math.abs(parseRupiah(row[columnMap['Total settlement amount']]));
    
    // Update stats
    stats.total_platform_fee += platformFee;
    stats.total_ams += affiliateSum;
    stats.total_income += totalIncome;
    
    return {
      'No. Pesanan': row[columnMap['Order/adjustment ID']],
      'Tanggal Dana Dilepaskan': row[columnMap['Order settled time']],
      'Biaya Platform': platformFee,
      'Biaya Komisi AMS': affiliateSum,
      'Total Penghasilan': totalIncome
    };
  });
  
  return { data: processedRows, stats };
}

export default function TikTokPencairan() {
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
        
        const { data: rawData } = await parseTikTokIncomeFile(file);
        if (rawData && rawData.length > 0) {
          allRawData = allRawData.concat(rawData);
          fileNames.push(file.name);
        }
      }
      
      if (allRawData.length === 0) {
        throw new Error('Semua file kosong atau tidak valid');
      }
      
      // Process combined income
      const { data: outputData, stats } = processTikTokIncome(allRawData);
      
      // Generate CSV
      const csv = Papa.unparse(outputData, { quotes: true, delimiter: ",", header: true });
      const csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const csvFile = new File([csvBlob], `tiktok_income_combined_${Date.now()}.csv`, { type: 'text/csv' });
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
      XLSX.utils.book_append_sheet(wb, ws, 'Tiktok_Income_Clean');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `tiktok_income_combined_${Date.now()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
          <h1 className="text-3xl font-bold text-slate-900">Pencairan TikTok (Income)</h1>
          <p className="text-slate-600">Upload file pencairan TikTok untuk diproses (Dana Dilepaskan)</p>
        </div>
        
        {/* File Uploader */}
        <MultiFileUploader 
          files={files}
          onFilesSelect={handleFilesSelect}
          onRemoveFile={handleRemoveFile}
          accept=".xlsx,.csv"
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
              className="bg-purple-600 hover:bg-purple-700 text-white px-8"
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
              : "Memproses file income TikTok..."
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