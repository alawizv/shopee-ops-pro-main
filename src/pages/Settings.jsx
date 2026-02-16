import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Shield, Trash2, Info } from 'lucide-react';

export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600">Konfigurasi dan informasi aplikasi</p>
        </div>
        
        {/* Storage Policy */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Kebijakan Penyimpanan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">Masa Simpan File (TTL)</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                File mentah (raw) dan file hasil (output) disimpan selama <strong>24 jam</strong> sejak upload/proses. 
                Setelah masa berlaku habis, file akan otomatis dihapus dari sistem secara permanen.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">Penghapusan Manual</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Anda dapat menghapus file kapan saja melalui tombol yang tersedia di halaman hasil proses:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 ml-4">
                <li><strong>Delete Raw</strong> - Hapus file mentah yang diupload</li>
                <li><strong>Delete Output</strong> - Hapus file hasil proses</li>
                <li><strong>Purge Session</strong> - Hapus semua file (raw + output)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Security */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Keamanan & Privasi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">Akses File</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Semua file bersifat privat dan hanya dapat diakses oleh pengguna yang mengupload. 
                Tidak ada akses publik ke file Anda.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900">Data Logging</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sistem hanya menyimpan statistik proses (jumlah baris, split, dll). 
                Data sensitif seperti alamat, telepon, dan nama pelanggan tidak disimpan dalam log.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* App Info */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-slate-600" />
              Informasi Aplikasi
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Nama Aplikasi</span>
                <span className="font-medium text-slate-900">Shopee Ops Transformer</span>
              </div>
              <div className="flex justify-between">
                <span>Versi</span>
                <span className="font-medium text-slate-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Platform</span>
                <span className="font-medium text-slate-900">Base44</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}