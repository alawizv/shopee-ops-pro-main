import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import MultiFileUploader from '../components/shared/MultiFileUploader';
import StatsCard from '../components/shared/StatsCard';
import ProcessingProgress from '../components/shared/ProcessingProgress';
import OutputFilesList from '../components/shared/OutputFilesList';
import { toast } from 'sonner';
import { FileSpreadsheet, CheckCircle, XCircle, Split } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// Parse Rupiah - handles Indonesian currency format
function parseRupiah(value) {
  if (value === null || value === undefined || value === '') return 0;
  
  // If already a number, use it
  if (typeof value === 'number') {
    return Math.round(value);
  }
  
  // Convert to string and clean
  let str = String(value).trim();
  
  // Remove Rp, spaces, and other non-numeric except dots and commas
  str = str.replace(/Rp\.?/g, '').replace(/\s/g, '');
  
  // Indonesian format: 94.500 = 94500 (dot as thousand separator)
  // Remove dots (thousand separators)
  str = str.replace(/\./g, '');
  
  // Remove commas (decimal - we ignore decimals for rupiah)
  str = str.replace(/,.*$/, '');
  
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

// Helper to split value evenly with remainder distribution
function splitEvenly(total, count) {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - (base * count);
  
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }
  return result;
}

// Inline file parser
async function parseFile(file, sheetName = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data, { header: true, skipEmptyLines: true, dynamicTyping: true });
          if (result.errors.length > 0) {
            reject(new Error('Error parsing CSV: ' + result.errors[0].message));
            return;
          }
          resolve({ data: result.data, sheets: null });
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheets = workbook.SheetNames;
          const targetSheet = sheetName || sheets[0];
          if (!sheets.includes(targetSheet)) {
            reject(new Error(`Sheet "${targetSheet}" tidak ditemukan`));
            return;
          }
          const worksheet = workbook.Sheets[targetSheet];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });
          resolve({ data: jsonData, sheets: sheets });
        }
      } catch (error) {
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

// Inline order processor
function processShopeeOrders(rawData, platform, plnInput = '', brandMappings = []) {
  // Create SKU to brand lookup
  const skuToBrand = {};
  brandMappings.forEach(m => {
    skuToBrand[m.nama_barang.toLowerCase().trim()] = m.brand.toUpperCase();
  });
  
  // Helper to get brand from SKU
  const getBrandFromSKU = (sku) => {
    const key = String(sku || '').toLowerCase().trim();
    return skuToBrand[key] || 'ZANEVA'; // default to ZANEVA if not found
  };
  
  // Helper to format platform with brand
  const formatPlatform = (platformName, sku) => {
    const brand = getBrandFromSKU(sku);
    const exceptionalPlatforms = ['MP SHOPEE YUNI', 'MP SHOPEE DITA', 'MP SHOPEE TRINDA', 'MP SHOPEE DILLA', 'MP SHOPEE ZANEVA'];
    
    // If platform is in exceptional list AND brand is ZANEVA, don't add brand suffix
    if (exceptionalPlatforms.includes(platformName) && brand === 'ZANEVA') {
      return platformName;
    }
    
    // Otherwise add brand in parentheses
    return `${platformName} (${brand})`;
  };
  const REQUIRED_COLUMNS = ['No. Pesanan', 'Status Pesanan', 'No. Resi', 'Waktu Pesanan Dibuat', 'Nomor Referensi SKU', 'Harga Setelah Diskon', 'Jumlah', 'Kota/Kabupaten', 'Provinsi', 'Username (Pembeli)', 'Nama Penerima', 'No. Telepon', 'Alamat Pengiriman'];
  const missingColumns = REQUIRED_COLUMNS.filter(col => !rawData[0]?.hasOwnProperty(col));
  if (missingColumns.length > 0) throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(', ')}`);
  
  const stats = { input_rows: rawData.length, deleted_rows: 0, split_count: 0, output_rows: 0, total_orders: 0 };
  const activeOrders = rawData.filter(row => {
    const status = String(row['Status Pesanan'] || '').toLowerCase();
    const isCancelled = status.includes('batal') || status.includes('dibatalkan');
    const cancelCol = row['Status Pembatalan/Pengembalian'];
    const hasCancellation = cancelCol && String(cancelCol).trim() !== '';
    if (isCancelled || hasCancellation) { stats.deleted_rows++; return false; }
    return true;
  });
  if (activeOrders.length === 0) throw new Error('Tidak ada data setelah filter batal');
  
  const orderGroups = {};
  activeOrders.forEach(row => {
    const orderNo = row['No. Pesanan'];
    if (!orderGroups[orderNo]) orderGroups[orderNo] = { rows: [], voucher: 0 };
    const voucherValue = parseRupiah(row['Voucher Ditanggung Penjual']);
    if (voucherValue > orderGroups[orderNo].voucher) orderGroups[orderNo].voucher = voucherValue;
    orderGroups[orderNo].rows.push(row);
  });
  stats.total_orders = Object.keys(orderGroups).length;
  
  const processedRows = [];
  Object.entries(orderGroups).forEach(([orderNo, orderData]) => {
    const splitRows = [];
    orderData.rows.forEach(row => {
      const skuString = String(row['Nomor Referensi SKU'] || '');
      let skuItems = skuString.includes(' + ') ? skuString.split(' + ') : skuString.split('+');
      skuItems = skuItems.map(s => s.trim()).filter(s => s.length > 0);
      if (skuItems.length === 0) skuItems = [skuString];
      if (skuItems.length > 1) stats.split_count += (skuItems.length - 1);
      
      const priceAfterDiscount = parseRupiah(row['Harga Setelah Diskon']);
      const splitPrices = splitEvenly(priceAfterDiscount, skuItems.length);
      skuItems.forEach((sku, idx) => {
        splitRows.push({ 
          ...row, 
          'Nomor Referensi SKU': sku, 
          'Harga Setelah Diskon': splitPrices[idx] 
        });
      });
    });
    
    const itemCount = splitRows.length;
    const voucherSplits = splitEvenly(orderData.voucher, itemCount);
    
    splitRows.forEach((row, idx) => {
      const qty = parseInt(row['Jumlah']) || 1;
      const priceAfterDiscount = row['Harga Setelah Diskon'];
      const voucherSplit = voucherSplits[idx];
      const finalPrice = (priceAfterDiscount * qty) - voucherSplit;
      
      processedRows.push({
        'No Pesanan': row['No. Pesanan'], 
        'Status Pesanan': row['Status Pesanan'], 
        'No. Resi': row['No. Resi'] || '',
        'Waktu Pesanan Dibuat': row['Waktu Pesanan Dibuat'], 
        'Metode Pembayaran': '', 
        'Nomor Referensi SKU': row['Nomor Referensi SKU'],
        'Harga Setelah Diskon': priceAfterDiscount, 
        'ONGKIR': '', 
        'HARGA AKHIR': finalPrice, 
        'Jumlah': qty,
        'Kota/Kabupaten': row['Kota/Kabupaten'] || '', 
        'Provinsi': row['Provinsi'] || '', 
        'Platform': formatPlatform(platform, row['Nomor Referensi SKU']),
        'Username (Pembeli)': row['Username (Pembeli)'] || '', 
        'Nama Penerima': row['Nama Penerima'] || '',
        'No. Telepon': row['No. Telepon'] || '', 
        'Alamat Pengiriman': row['Alamat Pengiriman'] || '',
        'PLN/INPUT': plnInput
      });
    });
  });
  stats.output_rows = processedRows.length;
  return { data: processedRows, stats };
}

const PLATFORM_OPTIONS = [
  'MP SHOPEE YUNI',
  'MP SHOPEE DITA',
  'MP SHOPEE TRINDA',
  'MP SHOPEE DILLA',
  'MP SHOPEE ZANEVA',
  'MP SHOPEE OBERBE',
  'MP SHOPEE BESYARI',
  'MP SHOPEE MUSWIM'
];

const PLN_OPTIONS = [
  'dita.zaneva@gmail.com',
  'yuni.zaneva@gmail.com',
  'trinda.zaneva@gmail.com',
  'mariss.zaneva@gmail.com',
  'kaniazaneva@gmail.com',
  'cs1.zaneva@gmail.com',
  'ayu.zaneva@gmail.com'
];

export default function ShopeeProcessOrder() {
  const [files, setFiles] = useState([]);
  const [platform, setPlatform] = useState(PLATFORM_OPTIONS[0]);
  const [plnInput, setPlnInput] = useState(PLN_OPTIONS[0]);
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
      // Fetch brand mappings once
      const brandMappings = await base44.entities.ProductBrand.list('', 5000);
      
      // Collect all data from all files
      let allRawData = [];
      const fileNames = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });
        
        const { data: rawData } = await parseFile(file);
        if (rawData && rawData.length > 0) {
          allRawData = allRawData.concat(rawData);
          fileNames.push(file.name);
        }
      }
      
      if (allRawData.length === 0) {
        throw new Error('Semua file kosong atau tidak valid');
      }
      
      // Process combined orders
      const { data: outputData, stats } = processShopeeOrders(allRawData, platform, plnInput, brandMappings);
      
      // Generate CSV
      const csv = Papa.unparse(outputData, { quotes: true, delimiter: ",", header: true });
      const csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const csvFile = new File([csvBlob], `orders_combined_${Date.now()}.csv`, { type: 'text/csv' });
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
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `orders_combined_${Date.now()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const { file_url: excelUrl } = await base44.integrations.Core.UploadFile({ file: excelFile });
      
      // Create file record with TTL
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await base44.entities.ProcessedFile.create({
        file_type: 'order',
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
      
      toast.success(`Berhasil! ${stats.output_rows} baris diproses dari ${files.length} file (${stats.input_rows} baris input)`);
      
    } catch (err) {
      setError(err.message);
      toast.error('Gagal memproses file: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
    }
  };
  


  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2 flex-1">
            <h1 className="text-3xl font-bold text-slate-900">Proses Order Shopee</h1>
            <p className="text-slate-600">Upload file order Shopee untuk diproses (To Ship / Order Export)</p>
          </div>
          <div className="flex gap-4">
            <div className="w-64 space-y-2">
              <Label htmlFor="platform-select" className="text-sm font-medium text-slate-700">Platform Shopee</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform-select" className="bg-white border-2 border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-64 space-y-2">
              <Label htmlFor="pln-select" className="text-sm font-medium text-slate-700">PLN/INPUT</Label>
              <Select value={plnInput} onValueChange={setPlnInput}>
                <SelectTrigger id="pln-select" className="bg-white border-2 border-red-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLN_OPTIONS.map(email => (
                    <SelectItem key={email} value={email}>{email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
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
              : "Memproses file order Shopee..."
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