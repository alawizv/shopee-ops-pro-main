import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data, { header: true, skipEmptyLines: true });
          resolve(result.data);
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
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

export default function ProductBrandMapping() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  
  const queryClient = useQueryClient();
  
  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['productBrands'],
    queryFn: () => base44.entities.ProductBrand.list('-created_date', 1000),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductBrand.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['productBrands']);
      toast.success('Mapping dihapus');
    },
  });
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const data = await parseFile(file);
      
      if (!data || data.length === 0) {
        throw new Error('File kosong');
      }
      
      // Validate columns
      const firstRow = data[0];
      const hasNamaBarang = firstRow.hasOwnProperty('NAMA BARANG') || firstRow.hasOwnProperty('nama_barang');
      const hasBrand = firstRow.hasOwnProperty('BRAND') || firstRow.hasOwnProperty('brand');
      
      if (!hasNamaBarang || !hasBrand) {
        throw new Error('File harus memiliki kolom NAMA BARANG dan BRAND');
      }
      
      // Map to correct format
      const mappingsToCreate = data.map(row => ({
        nama_barang: row['NAMA BARANG'] || row['nama_barang'] || '',
        brand: row['BRAND'] || row['brand'] || ''
      })).filter(m => m.nama_barang && m.brand);
      
      if (mappingsToCreate.length === 0) {
        throw new Error('Tidak ada data valid untuk diupload');
      }
      
      // Bulk create
      await base44.entities.ProductBrand.bulkCreate(mappingsToCreate);
      
      queryClient.invalidateQueries(['productBrands']);
      toast.success(`${mappingsToCreate.length} mapping berhasil diupload`);
      setFile(null);
      
    } catch (err) {
      setError(err.message);
      toast.error('Upload gagal: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleClearAll = async () => {
    if (!confirm('Hapus semua mapping? Tindakan ini tidak dapat dibatalkan.')) return;
    
    try {
      for (const mapping of mappings) {
        await base44.entities.ProductBrand.delete(mapping.id);
      }
      queryClient.invalidateQueries(['productBrands']);
      toast.success('Semua mapping dihapus');
    } catch (err) {
      toast.error('Gagal menghapus: ' + err.message);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mapping Produk & Brand</h1>
          <p className="text-slate-600 mt-2">Upload file CSV/Excel dengan kolom: NAMA BARANG, BRAND</p>
        </div>
        
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                disabled={isUploading}
                className="flex-1 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Mappings List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mapping Tersimpan ({mappings.length})</CardTitle>
            {mappings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Hapus Semua
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-slate-500">Loading...</p>
            ) : mappings.length === 0 ? (
              <p className="text-center py-8 text-slate-500">Belum ada mapping. Upload file untuk menambahkan.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.nama_barang}</TableCell>
                        <TableCell>{mapping.brand}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(mapping.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}