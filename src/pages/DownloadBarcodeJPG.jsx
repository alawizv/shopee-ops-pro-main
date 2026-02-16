import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Image as ImageIcon, Archive } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BarcodeInput, BarcodeItemsList } from '../components/barcode/BarcodeShared';
import { generateBarcodeJPG } from '../components/barcode/BarcodeUtils';

export default function DownloadBarcodeJPG() {
  const [activeTab, setActiveTab] = useState('upload');
  const [items, setItems] = useState([]);
  const [barcodeType, setBarcodeType] = useState('barcode');
  const [jpgModalOpen, setJpgModalOpen] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  
  const [settings, setSettings] = useState({
    fontSize: 8,
    showCode: true,
    showLabel: true,
    barcodeWidth: 2,
    barcodeHeight: 40
  });
  
  const [showAutoAdjustHint, setShowAutoAdjustHint] = useState(false);
  
  // Auto-adjust for barcode type changes
  React.useEffect(() => {
    if (barcodeType === 'barcode') {
      setSettings(prev => ({
        ...prev,
        barcodeWidth: 2,
        barcodeHeight: 40,
        fontSize: 8
      }));
    } else if (barcodeType === 'qrcode') {
      setSettings(prev => ({
        ...prev,
        barcodeWidth: 40,
        barcodeHeight: 40,
        fontSize: 8
      }));
    }
    setShowAutoAdjustHint(true);
    setTimeout(() => setShowAutoAdjustHint(false), 5000);
  }, [barcodeType]);
  
  const downloadSingleJPG = async (item) => {
    const toastId = toast.loading('Generating JPG...');
    try {
      const jpgDataURL = await generateBarcodeJPG(item, barcodeType, settings);
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
        
        const jpgDataURL = await generateBarcodeJPG(item, barcodeType, settings);
        const base64Data = jpgDataURL.split(',')[1];
        
        const sanitizedCode = item.code.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedLabel = (item.label || '').replace(/[^a-zA-Z0-9]/g, '_');
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
  
  const selectedCount = items.filter(item => item.selected).length;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Download Barcode (JPG)</h1>
          <p className="text-slate-600 mt-1">Download barcode dan QR code dalam format JPG</p>
        </div>
        
        <BarcodeInput 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onItemsChange={setItems}
          items={items}
        />
        
        <BarcodeItemsList items={items} onItemsChange={setItems} />
        
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
                  Ukuran otomatis disesuaikan untuk {barcodeType === 'qrcode' ? 'QR Code' : 'Barcode'}. Anda bisa edit manual.
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
        
        {items.length > 0 && selectedCount > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-sm text-slate-700">
                    <strong>{selectedCount}</strong> item terpilih
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    onClick={() => setJpgModalOpen(true)}
                    disabled={isGeneratingZip}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Download JPG Satuan
                  </Button>
                  <Button
                    onClick={downloadAllJPG}
                    disabled={isGeneratingZip}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isGeneratingZip ? 'Generating...' : 'Download Semua JPG (ZIP)'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
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