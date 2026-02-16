import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, Plus, Trash2, Download, Eye, Printer, Image as ImageIcon, Archive } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BarcodeGenerator() {
  const [activeTab, setActiveTab] = useState('upload');
  const [items, setItems] = useState([]);
  const [barcodeType, setBarcodeType] = useState('barcode');
  const [paperFormat, setPaperFormat] = useState('a4-multi');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [jpgModalOpen, setJpgModalOpen] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({
    barcodeWidth: 2,
    barcodeHeight: 40,
    fontSize: 8,
    showCode: true,
    showLabel: true,
    columns: 3,
    rows: 10,
    customWidth: 210,
    customHeight: 297
  });
  
  // Manual input
  const [manualInput, setManualInput] = useState({
    code: '',
    label: '',
    qty: 1
  });
  
  const fileInputRef = useRef(null);
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const newItems = jsonData.map((row, idx) => ({
        id: Date.now() + idx,
        code: row.SKU || row.sku || '',
        label: row['Nama Produk'] || row['nama_produk'] || row['Nama'] || '',
        qty: 1,
        selected: true
      }));
      
      setItems(newItems);
      toast.success(`${newItems.length} produk berhasil diimport`);
    } catch (error) {
      toast.error('Gagal membaca file: ' + error.message);
    }
  };
  
  // Add manual item
  const handleAddManual = () => {
    if (!manualInput.code) {
      toast.error('Kode barcode harus diisi');
      return;
    }
    
    const newItem = {
      id: Date.now(),
      code: manualInput.code,
      label: manualInput.label,
      qty: parseInt(manualInput.qty) || 1,
      selected: true
    };
    
    setItems([...items, newItem]);
    setManualInput({ code: '', label: '', qty: 1 });
    toast.success('Item ditambahkan');
  };
  
  // Update item
  const updateItem = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  // Delete item
  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };
  
  // Select/Deselect all
  const selectAll = () => {
    setItems(items.map(item => ({ ...item, selected: true })));
  };
  
  const deselectAll = () => {
    setItems(items.map(item => ({ ...item, selected: false })));
  };
  
  // Generate barcode as data URL
  const generateBarcodeDataURL = async (code, type) => {
    try {
      if (type === 'qrcode') {
        return await QRCode.toDataURL(code, { 
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'H'
        });
      } else {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, code, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 10,
          fontSize: 14,
          background: '#ffffff',
          lineColor: '#000000'
        });
        return canvas.toDataURL('image/png');
      }
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw new Error(`Gagal generate barcode: ${error.message}`);
    }
  };
  
  // Generate high-res barcode for JPG
  const generateBarcodeJPG = async (item) => {
    try {
      // Generate barcode/QR first
      const barcodeDataURL = await generateBarcodeDataURL(item.code, barcodeType);
      
      // Create canvas for final image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = 800;
      canvas.height = 400;
      
      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Load and draw barcode image
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            // Draw barcode centered
            const isQR = barcodeType === 'qrcode';
            const barcodeWidth = isQR ? 250 : 600;
            const barcodeHeight = isQR ? 250 : 200;
            const x = (canvas.width - barcodeWidth) / 2;
            const y = isQR ? 30 : 40;
            
            ctx.drawImage(img, x, y, barcodeWidth, barcodeHeight);
            
            // Draw text
            let textY = y + barcodeHeight + 30;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            
            if (settings.showCode) {
              ctx.font = `bold ${settings.fontSize * 2}px Arial`;
              ctx.fillText(item.code, canvas.width / 2, textY);
              textY += 30;
            }
            
            if (settings.showLabel && item.label) {
              ctx.font = `${(settings.fontSize - 1) * 2}px Arial`;
              // Wrap text if too long
              const maxWidth = canvas.width - 40;
              ctx.fillText(item.label, canvas.width / 2, textY, maxWidth);
            }
            
            resolve(canvas.toDataURL('image/jpeg', 0.95));
          } catch (drawError) {
            reject(new Error(`Gagal menggambar barcode: ${drawError.message}`));
          }
        };
        
        img.onerror = (err) => {
          console.error('Image load error:', err);
          reject(new Error('Gagal memuat gambar barcode'));
        };
        
        // Set cross-origin to allow canvas export
        img.crossOrigin = 'anonymous';
        img.src = barcodeDataURL;
      });
    } catch (error) {
      console.error('Generate JPG error:', error);
      throw new Error(`Gagal generate JPG: ${error.message}`);
    }
  };
  
  // Generate PDF
  const generatePDF = async () => {
    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('Tidak ada item yang dipilih');
      return;
    }
    
    setIsGenerating(true);
    const toastId = toast.loading('Generating PDF...');
    
    try {
      // Timeout after 30 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Proses terlalu lama')), 30000)
      );
      
      const generatePromise = (async () => {
        let pdf;
        
        if (paperFormat === 'thermal-33x19') {
          pdf = await generateThermalPDF(selectedItems, 33, 19);
        } else if (paperFormat === 'thermal-50x20') {
          pdf = await generateThermalPDF(selectedItems, 50, 20);
        } else if (paperFormat.startsWith('a4') || paperFormat.startsWith('f4')) {
          pdf = await generateStandardPDF(selectedItems);
        } else if (paperFormat === 'custom') {
          pdf = await generateCustomPDF(selectedItems);
        }
        
        return pdf;
      })();
      
      const pdf = await Promise.race([generatePromise, timeoutPromise]);
      
      const filename = `Barcode_${barcodeType}_${paperFormat}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      
      toast.success('PDF berhasil didownload!', { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Gagal generate PDF: ' + error.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Download single JPG
  const downloadSingleJPG = async (item) => {
    const toastId = toast.loading('Generating JPG...');
    try {
      const jpgDataURL = await generateBarcodeJPG(item);
      const link = document.createElement('a');
      const sanitizedCode = (item.code || 'barcode').replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedLabel = (item.label || 'label').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Barcode_${sanitizedCode}_${sanitizedLabel}.jpg`;
      link.href = jpgDataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('JPG berhasil didownload!', { id: toastId });
    } catch (error) {
      console.error('JPG download error:', error);
      toast.error('Gagal download JPG: ' + error.message, { id: toastId });
    }
  };
  
  // Download all as ZIP
  const downloadAllJPG = async () => {
    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('Tidak ada item yang dipilih');
      return;
    }
    
    setIsGeneratingZip(true);
    const toastId = toast.loading(`Generating ${selectedItems.length} JPG files...`);
    
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        toast.loading(`Generating ${i + 1}/${selectedItems.length}...`, { id: toastId });
        
        const jpgDataURL = await generateBarcodeJPG(item);
        const base64Data = jpgDataURL.split(',')[1];
        
        const sanitizedCode = item.code.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedLabel = item.label.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Barcode_${sanitizedCode}_${sanitizedLabel}.jpg`;
        
        zip.file(filename, base64Data, { base64: true });
      }
      
      toast.loading('Creating ZIP file...', { id: toastId });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Barcodes_${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      
      URL.revokeObjectURL(link.href);
      toast.success(`${selectedItems.length} barcode berhasil didownload!`, { id: toastId });
    } catch (error) {
      console.error('ZIP generation error:', error);
      toast.error('Gagal generate ZIP: ' + error.message, { id: toastId });
    } finally {
      setIsGeneratingZip(false);
    }
  };
  
  // Generate thermal label PDF
  const generateThermalPDF = async (selectedItems, width, height) => {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [width, height]
    });
    
    let isFirst = true;
    
    for (const item of selectedItems) {
      for (let i = 0; i < item.qty; i++) {
        if (!isFirst) {
          pdf.addPage([width, height], 'landscape');
        }
        isFirst = false;
        
        const barcodeDataURL = await generateBarcodeDataURL(item.code, barcodeType);
        
        // Calculate positions for centering
        const barcodeWidth = width * 0.8;
        const barcodeHeight = height * 0.5;
        const x = (width - barcodeWidth) / 2;
        const y = 2;
        
        pdf.addImage(barcodeDataURL, 'PNG', x, y, barcodeWidth, barcodeHeight);
        
        // Add text below barcode
        const textY = y + barcodeHeight + 2;
        pdf.setFontSize(settings.fontSize);
        
        if (settings.showCode) {
          pdf.text(item.code, width / 2, textY, { align: 'center' });
        }
        if (settings.showLabel && item.label) {
          pdf.setFontSize(settings.fontSize - 1);
          pdf.text(item.label, width / 2, textY + 3, { align: 'center', maxWidth: width - 4 });
        }
      }
    }
    
    return pdf;
  };
  
  // Generate standard paper PDF (A4/F4)
  const generateStandardPDF = async (selectedItems) => {
    const isA4 = paperFormat.startsWith('a4');
    const width = isA4 ? 210 : 215.9;
    const height = isA4 ? 297 : 330.2;
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isA4 ? 'a4' : [width, height]
    });
    
    const cols = settings.columns;
    const rows = settings.rows;
    const margin = 10;
    const cellWidth = (width - 2 * margin) / cols;
    const cellHeight = (height - 2 * margin) / rows;
    
    const isSingleRepeat = paperFormat.includes('single');
    
    let barcodeList = [];
    if (isSingleRepeat) {
      // Single product repeat: each item fills pages separately
      for (const item of selectedItems) {
        for (let i = 0; i < item.qty; i++) {
          barcodeList.push(item);
        }
      }
    } else {
      // Multi product: all items mixed together
      for (const item of selectedItems) {
        for (let i = 0; i < item.qty; i++) {
          barcodeList.push(item);
        }
      }
    }
    
    let isFirst = true;
    
    for (let idx = 0; idx < barcodeList.length; idx++) {
      const pageIndex = Math.floor(idx / (cols * rows));
      const posInPage = idx % (cols * rows);
      
      if (posInPage === 0 && !isFirst) {
        pdf.addPage();
      }
      isFirst = false;
      
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;
      
      const item = barcodeList[idx];
      const barcodeDataURL = await generateBarcodeDataURL(item.code, barcodeType);
      
      const barcodeWidth = cellWidth * 0.8;
      const barcodeHeight = cellHeight * 0.4;
      const barcodeX = x + (cellWidth - barcodeWidth) / 2;
      const barcodeY = y + 2;
      
      pdf.addImage(barcodeDataURL, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
      
      const textY = barcodeY + barcodeHeight + 2;
      pdf.setFontSize(settings.fontSize);
      
      if (settings.showCode) {
        pdf.text(item.code, x + cellWidth / 2, textY, { align: 'center' });
      }
      if (settings.showLabel && item.label) {
        pdf.setFontSize(settings.fontSize - 1);
        pdf.text(item.label, x + cellWidth / 2, textY + 3, { 
          align: 'center', 
          maxWidth: cellWidth - 4 
        });
      }
    }
    
    return pdf;
  };
  
  // Generate custom size PDF
  const generateCustomPDF = async (selectedItems) => {
    const width = settings.customWidth;
    const height = settings.customHeight;
    
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [width, height]
    });
    
    const cols = settings.columns;
    const rows = settings.rows;
    const margin = 5;
    const cellWidth = (width - 2 * margin) / cols;
    const cellHeight = (height - 2 * margin) / rows;
    
    let barcodeList = [];
    for (const item of selectedItems) {
      for (let i = 0; i < item.qty; i++) {
        barcodeList.push(item);
      }
    }
    
    let isFirst = true;
    
    for (let idx = 0; idx < barcodeList.length; idx++) {
      const posInPage = idx % (cols * rows);
      
      if (posInPage === 0 && !isFirst) {
        pdf.addPage([width, height]);
      }
      isFirst = false;
      
      const col = posInPage % cols;
      const row = Math.floor(posInPage / cols);
      
      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;
      
      const item = barcodeList[idx];
      const barcodeDataURL = await generateBarcodeDataURL(item.code, barcodeType);
      
      const barcodeWidth = cellWidth * 0.8;
      const barcodeHeight = cellHeight * 0.4;
      const barcodeX = x + (cellWidth - barcodeWidth) / 2;
      const barcodeY = y + 2;
      
      pdf.addImage(barcodeDataURL, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
      
      const textY = barcodeY + barcodeHeight + 2;
      pdf.setFontSize(settings.fontSize);
      
      if (settings.showCode) {
        pdf.text(item.code, x + cellWidth / 2, textY, { align: 'center' });
      }
      if (settings.showLabel && item.label) {
        pdf.setFontSize(settings.fontSize - 1);
        pdf.text(item.label, x + cellWidth / 2, textY + 3, { 
          align: 'center', 
          maxWidth: cellWidth - 4 
        });
      }
    }
    
    return pdf;
  };
  
  const selectedCount = items.filter(item => item.selected).length;
  const totalBarcodes = items.filter(item => item.selected).reduce((sum, item) => sum + item.qty, 0);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Barcode Generator</h1>
          <p className="text-slate-600 mt-1">Generate barcode dan QR code untuk produk Anda</p>
        </div>
        
        {/* Input Mode */}
        <Card>
          <CardHeader>
            <CardTitle>Input Data</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Dari SKU Produk</TabsTrigger>
                <TabsTrigger value="manual">Single / Manual Input</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
                  <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600 mb-3">
                    Upload file Excel (.xlsx) dengan kolom <strong>SKU</strong> dan <strong>Nama Produk</strong>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Pilih File Excel
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <Label>Kode Barcode *</Label>
                    <Input
                      value={manualInput.code}
                      onChange={(e) => setManualInput({ ...manualInput, code: e.target.value })}
                      placeholder="SKU123"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Label / Nama</Label>
                    <Input
                      value={manualInput.label}
                      onChange={(e) => setManualInput({ ...manualInput, label: e.target.value })}
                      placeholder="Nama Produk"
                    />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={manualInput.qty}
                      onChange={(e) => setManualInput({ ...manualInput, qty: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddManual}>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah ke List
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Items List */}
        {items.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>List Barcode ({selectedCount} terpilih dari {items.length})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>No</TableHead>
                      <TableHead>SKU/Kode</TableHead>
                      <TableHead>Nama Produk</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => updateItem(item.id, 'selected', checked)}
                          />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{item.code}</TableCell>
                        <TableCell>
                          <Input
                            value={item.label}
                            onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                            className="min-w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Barcode Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Barcode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipe Barcode</Label>
                <Select value={barcodeType} onValueChange={setBarcodeType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barcode">Barcode (Code 128C)</SelectItem>
                    <SelectItem value="qrcode">QR Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lebar (mm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.barcodeWidth}
                    onChange={(e) => setSettings({ ...settings, barcodeWidth: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Tinggi (mm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.barcodeHeight}
                    onChange={(e) => setSettings({ ...settings, barcodeHeight: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              
              <div>
                <Label>Ukuran Font Label (pt)</Label>
                <Input
                  type="number"
                  min="4"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showCode"
                  checked={settings.showCode}
                  onCheckedChange={(checked) => setSettings({ ...settings, showCode: checked })}
                />
                <Label htmlFor="showCode" className="cursor-pointer">
                  Tampilkan kode di bawah barcode
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showLabel"
                  checked={settings.showLabel}
                  onCheckedChange={(checked) => setSettings({ ...settings, showLabel: checked })}
                />
                <Label htmlFor="showLabel" className="cursor-pointer">
                  Tampilkan nama/label di bawah barcode
                </Label>
              </div>
            </CardContent>
          </Card>
          
          {/* Paper Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Kertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Format Kertas</Label>
                <Select value={paperFormat} onValueChange={setPaperFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4-multi">A4 (210x297mm) - Multi Produk</SelectItem>
                    <SelectItem value="a4-single">A4 (210x297mm) - Single Produk Repeat</SelectItem>
                    <SelectItem value="f4-multi">F4/Folio (215.9x330.2mm) - Multi Produk</SelectItem>
                    <SelectItem value="f4-single">F4/Folio (215.9x330.2mm) - Single Produk Repeat</SelectItem>
                    <SelectItem value="thermal-33x19">Thermal 33x19mm (per label)</SelectItem>
                    <SelectItem value="thermal-50x20">Thermal 50x20mm (per label)</SelectItem>
                    <SelectItem value="custom">Custom Size</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {!paperFormat.includes('thermal') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Kolom per Halaman</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.columns}
                      onChange={(e) => setSettings({ ...settings, columns: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Baris per Halaman</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={settings.rows}
                      onChange={(e) => setSettings({ ...settings, rows: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              
              {paperFormat === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lebar Kertas (mm)</Label>
                    <Input
                      type="number"
                      min="10"
                      value={settings.customWidth}
                      onChange={(e) => setSettings({ ...settings, customWidth: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Tinggi Kertas (mm)</Label>
                    <Input
                      type="number"
                      min="10"
                      value={settings.customHeight}
                      onChange={(e) => setSettings({ ...settings, customHeight: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Action Buttons */}
        {items.length > 0 && selectedCount > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-700">
                    <strong>{totalBarcodes}</strong> barcode terpilih dari <strong>{selectedCount}</strong> item
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    onClick={generatePDF}
                    disabled={isGenerating || isGeneratingZip}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isGenerating ? 'Generating...' : 'Download PDF'}
                  </Button>
                  <Button
                    onClick={() => setJpgModalOpen(true)}
                    disabled={isGenerating || isGeneratingZip}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Download JPG Satuan
                  </Button>
                  <Button
                    onClick={downloadAllJPG}
                    disabled={isGenerating || isGeneratingZip}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isGeneratingZip ? 'Generating...' : 'Download Semua JPG (ZIP)'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* JPG Download Modal */}
        <Dialog open={jpgModalOpen} onOpenChange={setJpgModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Download JPG Satuan</DialogTitle>
              <DialogDescription>
                Pilih barcode yang ingin didownload sebagai file JPG
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {items.filter(item => item.selected).map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">{item.code}</p>
                      <p className="text-xs text-slate-600">{item.label}</p>
                      <Button
                        size="sm"
                        onClick={() => downloadSingleJPG(item)}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download JPG
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}