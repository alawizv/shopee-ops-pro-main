import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

export default function ProcessingProgress({ message = "Memproses file...", progress = null }) {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">{message}</p>
            {progress !== null && (
              <Progress value={progress} className="mt-2 h-2" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}