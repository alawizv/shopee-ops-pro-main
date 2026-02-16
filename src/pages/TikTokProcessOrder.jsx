import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

// Parse TikTok file
async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data, { header: true, skipEmptyLines: true, dynamicTyping: false });
          if (result.errors.length > 0) {
            reject(new Error('Error parsing CSV: ' + result.errors[0].message));
            return;
          }
          resolve({ data: result.data });
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });
          resolve({ data: jsonData });
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

// Column mapping (header name or Excel column letter)
const COLUMN_MAP = {
  'No Pesanan': ['Order ID', '__EMPTY'],
  'Status Pesanan': ['Order Status', '__EMPTY_1'],
  'No. Resi': ['Tracking ID', '__EMPTY_39'],
  'Waktu Pesanan Dibuat': ['Created Time', '__EMPTY_29'],
  'Metode Pembayaran': ['Payment Method', '__EMPTY_77'],
  'Nomor Referensi SKU': ['Seller SKU', '__EMPTY_6'],
  'Harga Setelah Diskon': ['SKU Subtotal After Discount', '__EMPTY_15'],
  'ONGKIR': ['Shipping Fee After Discount', '__EMPTY_16'],
  'Jumlah': ['Quantity', '__EMPTY_9'],
  'Kota/Kabupaten': ['Regency and City', '__EMPTY_49'],
  'Provinsi': ['Province', '__EMPTY_48'],
  'Username (Pembeli)': ['Buyer Username', '__EMPTY_43'],
  'Nama Penerima': ['Recipient', '__EMPTY_44'],
  'No. Telepon': ['Phone #', '__EMPTY_45'],
  'Alamat Pengiriman': ['Detail Address', '__EMPTY_75']
};

function findColumnValue(row, aliases) {
  for (const alias of aliases) {
    if (row.hasOwnProperty(alias) && row[alias] !== null && row[alias] !== undefined) {
      return row[alias];
    }
  }
  return '';
}

// Process TikTok orders
function processTikTokOrders(rawData, platform, plnInput, brandMappings = []) {
  // Create SKU to brand lookup
  const skuToBrand = {};
  brandMappings.forEach(m => {
    skuToBrand[m.nama_barang.toLowerCase().trim()] = m.brand.toUpperCase();
  });
  
  // Helper to get brand from SKU
  const getBrandFromSKU = (sku) => {
    const key = String(sku || '').toLowerCase().trim();
    return skuToBrand[key] || 'ZANEVA';
  };
  
  // Helper to format platform with brand
  const formatPlatform = (platformName, sku) => {
    const brand = getBrandFromSKU(sku);
    
    // If platform is "MP TIKTOK" AND brand is ZANEVA, don't add brand suffix
    if (platformName === 'MP TIKTOK' && brand === 'ZANEVA') {
      return platformName;
    }
    
    // Otherwise add brand in parentheses
    return `${platformName} (${brand})`;
  };
  
  const stats = { input_rows: rawData.length, deleted_rows: 0, split_count: 0, output_rows: 0, total_orders: 0 };
  
  // Filter cancelled orders
  const activeOrders = rawData.filter(row => {
    const status = String(findColumnValue(row, COLUMN_MAP['Status Pesanan']) || '').toLowerCase();
    const isCancelled = status.includes('batal') || status.includes('dibatalkan') || 
                        status.includes('cancel') || status.includes('cancelled') ||
                        status.includes('refund') || status.includes('returned');
    if (isCancelled) { 
      stats.deleted_rows++; 
      return false; 
    }
    return true;
  });
  
  if (activeOrders.length === 0) throw new Error('Tidak ada data setelah filter batal');
  
  // Group by Order ID
  const orderGroups = {};
  activeOrders.forEach(row => {
    const orderNo = findColumnValue(row, COLUMN_MAP['No Pesanan']);
    if (!orderGroups[orderNo]) {
      orderGroups[orderNo] = { rows: [], maxShipping: 0 };
    }
    const shippingFee = parseRupiah(findColumnValue(row, COLUMN_MAP['ONGKIR']));
    if (shippingFee > orderGroups[orderNo].maxShipping) {
      orderGroups[orderNo].maxShipping = shippingFee;
    }
    orderGroups[orderNo].rows.push(row);
  });
  
  stats.total_orders = Object.keys(orderGroups).length;
  
  const processedRows = [];
  
  Object.entries(orderGroups).forEach(([orderNo, orderData]) => {
    const splitRows = [];
    
    // Split SKU if contains "+"
    orderData.rows.forEach(row => {
      const skuString = String(findColumnValue(row, COLUMN_MAP['Nomor Referensi SKU']) || '');
      let skuItems = skuString.includes(' + ') ? skuString.split(' + ') : skuString.split('+');
      skuItems = skuItems.map(s => s.trim()).filter(s => s.length > 0);
      if (skuItems.length === 0) skuItems = [skuString];
      if (skuItems.length > 1) stats.split_count += (skuItems.length - 1);
      
      const priceAfterDiscount = parseRupiah(findColumnValue(row, COLUMN_MAP['Harga Setelah Diskon']));
      const splitPrices = splitEvenly(priceAfterDiscount, skuItems.length);
      
      skuItems.forEach((sku, idx) => {
        splitRows.push({ 
          ...row, 
          _sku: sku, 
          _price: splitPrices[idx] 
        });
      });
    });
    
    // Distribute shipping fee evenly across all items in the order
    const itemCount = splitRows.length;
    const shippingPerItem = splitEvenly(orderData.maxShipping, itemCount);
    
    splitRows.forEach((row, idx) => {
      const qty = parseInt(findColumnValue(row, COLUMN_MAP['Jumlah'])) || 1;
      const priceAfterDiscount = row._price;
      const ongkir = shippingPerItem[idx];
      const hargaAkhir = priceAfterDiscount; // HARGA AKHIR = P (SKU Subtotal After Discount)
      
      processedRows.push({
        'No Pesanan': findColumnValue(row, COLUMN_MAP['No Pesanan']),
        'Status Pesanan': findColumnValue(row, COLUMN_MAP['Status Pesanan']),
        'No. Resi': findColumnValue(row, COLUMN_MAP['No. Resi']) || '',
        'Waktu Pesanan Dibuat': findColumnValue(row, COLUMN_MAP['Waktu Pesanan Dibuat']),
        'Metode Pembayaran': findColumnValue(row, COLUMN_MAP['Metode Pembayaran']) || '',
        'Nomor Referensi SKU': row._sku,
        'Harga Setelah Diskon': priceAfterDiscount,
        'ONGKIR': ongkir,
        'HARGA AKHIR': hargaAkhir,
        'Jumlah': qty,
        'Kota/Kabupaten': findColumnValue(row, COLUMN_MAP['Kota/Kabupaten']) || '',
        'Provinsi': findColumnValue(row, COLUMN_MAP['Provinsi']) || '',
        'Platform': formatPlatform(platform, row._sku),
        'Username (Pembeli)': findColumnValue(row, COLUMN_MAP['Username (Pembeli)']) || '',
        'Nama Penerima': findColumnValue(row, COLUMN_MAP['Nama Penerima']) || '',
        'No. Telepon': findColumnValue(row, COLUMN_MAP['No. Telepon']) || '',
        'Alamat Pengiriman': findColumnValue(row, COLUMN_MAP['Alamat Pengiriman']) || '',
        'PLN/INPUT': plnInput,
        'Tgl Kirim': ''
      });
    });
  });
  
  stats.output_rows = processedRows.length;
  return { data: processedRows, stats };
}

const PLATFORM_OPTIONS = [
  'MP TIKTOK MUSWIM',
  'MP TIKTOK',
  'MP TIKTOK OBERBE',
  'MP TIKTOK BESYARI'
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

export default function TikTokProcessOrder() {
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
      const { data: outputData, stats } = processTikTokOrders(allRawData, platform, plnInput, brandMappings);
      
      // Generate CSV
      const csv = Papa.unparse(outputData, { quotes: true, delimiter: ",", header: true });
      const csvBlob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const csvFile = new File([csvBlob], `tiktok_orders_combined_${Date.now()}.csv`, { type: 'text/csv' });
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
      XLSX.utils.book_append_sheet(wb, ws, 'Tiktok_Orders_Clean');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const excelFile = new File([excelBlob], `tiktok_orders_combined_${Date.now()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
            <h1 className="text-3xl font-bold text-slate-900">Proses Order TikTok</h1>
            <p className="text-slate-600">Upload file order TikTok untuk diproses (Untuk Dikirim)</p>
          </div>
          <div className="flex gap-4">
            <div className="w-64 space-y-2">
              <Label htmlFor="platform-select" className="text-sm font-medium text-slate-700">Platform TikTok</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform-select" className="bg-white border-2 border-purple-500">
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
              : "Memproses file order TikTok..."
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