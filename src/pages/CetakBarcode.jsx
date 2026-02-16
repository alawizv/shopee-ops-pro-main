import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { BarcodeInput, BarcodeItemsList } from '../components/barcode/BarcodeShared';
import { generateBarcodeDataURL } from '../components/barcode/BarcodeUtils';

export default function CetakBarcode() {
  const [activeTab, setActiveTab] = useState('upload');
  const [items, setItems] = useState([]);
  const [barcodeType, setBarcodeType] = useState('barcode');
  const [paperFormat, setPaperFormat] = useState('a4-multi');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [settings, setSettings] = useState({
    fontSize: 8,
    showCode: true,
    showLabel: true,
    columns: 3,
    rows: 10,
    customWidth: 210,
    customHeight: 297,
    barcodeWidth: 2,
    barcodeHeight: 40
  });
  
  const [showAutoAdjustHint, setShowAutoAdjustHint] = useState(false);
  
  // Preset configurations for different paper formats
  const paperPresets = {
    'thermal-33x19': {
      barcode: { width: 1.2, height: 10, fontSize: 5 },
      qrcode: { width: 12, height: 12, fontSize: 4 }
    },
    'thermal-50x20': {
      barcode: { width: 1.5, height: 12, fontSize: 6 },
      qrcode: { width: 14, height: 14, fontSize: 5 }
    },
    'a4-multi': { width: 2, height: 40, fontSize: 8 },
    'a4-single': { width: 2, height: 40, fontSize: 8 },
    'f4-multi': { width: 2, height: 40, fontSize: 8 },
    'f4-single': { width: 2, height: 40, fontSize: 8 }
  };
  
  // Auto-adjust settings when paper format or barcode type changes
  React.useEffect(() => {
    const preset = paperPresets[paperFormat];
    if (preset) {
      if (paperFormat.startsWith('thermal')) {
        const config = preset[barcodeType];
        if (config) {
          setSettings(prev => ({
            ...prev,
            barcodeWidth: config.width,
            barcodeHeight: config.height,
            fontSize: config.fontSize
          }));
          setShowAutoAdjustHint(true);
          setTimeout(() => setShowAutoAdjustHint(false), 5000);
        }
      } else {
        setSettings(prev => ({
          ...prev,
          barcodeWidth: preset.width,
          barcodeHeight: preset.height,
          fontSize: preset.fontSize
        }));
        setShowAutoAdjustHint(true);
        setTimeout(() => setShowAutoAdjustHint(false), 5000);
      }
    }
  }, [paperFormat, barcodeType]);
  
  const generatePDF = async () => {
    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error('Tidak ada item yang dipilih');
      return;
    }
    
    setIsGenerating(true);
    const toastId = toast.loading('Generating PDF...');
    
    try {
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
        
        const barcodeWidth = width * 0.8;
        const barcodeHeight = height * 0.5;
        const x = (width - barcodeWidth) / 2;
        const y = 2;
        
        pdf.addImage(barcodeDataURL, 'PNG', x, y, barcodeWidth, barcodeHeight);
        
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cetak Barcode (PDF)</h1>
          <p className="text-slate-600 mt-1">Generate barcode dan QR code dalam format PDF untuk dicetak</p>
        </div>
        
        <BarcodeInput 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onItemsChange={setItems}
          items={items}
        />
        
        <BarcodeItemsList items={items} onItemsChange={setItems} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    min="0.5"
                    step="0.1"
                    value={settings.barcodeWidth}
                    onChange={(e) => {
                      setSettings({ ...settings, barcodeWidth: parseFloat(e.target.value) });
                      setShowAutoAdjustHint(false);
                    }}
                  />
                </div>
                <div>
                  <Label>Tinggi (mm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.barcodeHeight}
                    onChange={(e) => {
                      setSettings({ ...settings, barcodeHeight: parseFloat(e.target.value) });
                      setShowAutoAdjustHint(false);
                    }}
                  />
                </div>
              </div>
              
              <div>
                <Label>Ukuran Font Label (pt)</Label>
                <Input
                  type="number"
                  min="3"
                  max="24"
                  value={settings.fontSize}
                  onChange={(e) => {
                    setSettings({ ...settings, fontSize: parseInt(e.target.value) });
                    setShowAutoAdjustHint(false);
                  }}
                />
                {showAutoAdjustHint && (
                  <p className="text-xs text-slate-500 mt-1">
                    Ukuran otomatis disesuaikan untuk {paperFormat}. Anda bisa edit manual.
                  </p>
                )}
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
        
        {items.length > 0 && selectedCount > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-700">
                    <strong>{totalBarcodes}</strong> barcode terpilih dari <strong>{selectedCount}</strong> item
                  </p>
                </div>
                <Button
                  onClick={generatePDF}
                  disabled={isGenerating}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  {isGenerating ? 'Generating...' : 'Download PDF untuk Cetak'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}