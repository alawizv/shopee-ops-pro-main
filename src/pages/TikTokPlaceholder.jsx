import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket, Calendar } from 'lucide-react';

export default function TikTokPlaceholder() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">TikTok Shop</h1>
          <p className="text-slate-600">Fitur pengolahan TikTok Shop</p>
        </div>
        
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                <Rocket className="w-10 h-10 text-slate-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Coming Soon</h2>
                <p className="text-slate-600 max-w-md">
                  Fitur untuk memproses file TikTok Shop sedang dalam pengembangan. 
                  Nantikan update selanjutnya!
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>Segera hadir</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}