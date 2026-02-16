import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Shared component for file upload and manual input
export function BarcodeInput({ activeTab, setActiveTab, onItemsChange, items }) {
  const [manualInput, setManualInput] = React.useState({
    code: '',
    label: '',
    qty: 1
  });
  const fileInputRef = React.useRef(null);

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
      
      onItemsChange(newItems);
      toast.success(`${newItems.length} produk berhasil diimport`);
    } catch (error) {
      toast.error('Gagal membaca file: ' + error.message);
    }
  };

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
    
    onItemsChange([...items, newItem]);
    setManualInput({ code: '', label: '', qty: 1 });
    toast.success('Item ditambahkan');
  };

  return (
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
  );
}

// Shared component for items list
export function BarcodeItemsList({ items, onItemsChange }) {
  const updateItem = (id, field, value) => {
    onItemsChange(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const deleteItem = (id) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const selectAll = () => {
    onItemsChange(items.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    onItemsChange(items.map(item => ({ ...item, selected: false })));
  };

  const selectedCount = items.filter(item => item.selected).length;

  if (items.length === 0) return null;

  return (
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
  );
}