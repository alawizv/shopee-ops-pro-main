import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatsCard from '../components/shared/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, TrendingUp, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['processedFiles'],
    queryFn: () => base44.entities.ProcessedFile.list('-created_date', 10)
  });
  
  // Clean up expired files
  useEffect(() => {
    const cleanupExpired = async () => {
      const now = new Date();
      const expired = files.filter(f => {
        const expiresAt = new Date(f.expires_at);
        return expiresAt < now;
      });
      
      for (const file of expired) {
        await base44.entities.ProcessedFile.delete(file.id);
      }
    };
    
    if (files.length > 0) {
      cleanupExpired();
    }
  }, [files]);
  
  const totalProcessed = files.length;
  const orderFiles = files.filter(f => f.file_type === 'order').length;
  const incomeFiles = files.filter(f => f.file_type === 'income').length;
  const recentFiles = files.slice(0, 5);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Shopee Ops Transformer - Kelola file operasional Shopee Anda</p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            icon={FileSpreadsheet}
            label="Total File Diproses"
            value={totalProcessed}
            variant="primary"
          />
          <StatsCard
            icon={TrendingUp}
            label="File Order"
            value={orderFiles}
            variant="success"
          />
          <StatsCard
            icon={Zap}
            label="File Income"
            value={incomeFiles}
            variant="warning"
          />
          <StatsCard
            icon={Clock}
            label="TTL Storage"
            value="24 Jam"
            variant="default"
          />
        </div>
        
        {/* Recent Files */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-xl font-semibold">File Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500">Loading...</div>
            ) : recentFiles.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                Belum ada file yang diproses
              </div>
            ) : (
              <div className="divide-y">
                {recentFiles.map((file) => (
                  <div key={file.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          file.file_type === 'order' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          <FileSpreadsheet className={`w-5 h-5 ${
                            file.file_type === 'order' ? 'text-blue-600' : 'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{file.original_filename}</p>
                          <p className="text-sm text-slate-500">
                            {file.file_type === 'order' ? 'Proses Order' : 'Pencairan Income'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">
                          {format(new Date(file.created_date), 'dd MMM yyyy HH:mm')}
                        </p>
                        <p className="text-xs text-slate-500">
                          Kadaluarsa: {format(new Date(file.expires_at), 'dd MMM HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Kebijakan Retensi File</h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  File mentah dan hasil output disimpan selama <strong>24 jam</strong> untuk keperluan download ulang. 
                  Setelah masa berlaku habis, file akan otomatis dihapus dari sistem. Anda juga dapat menghapus file secara manual kapan saja.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}