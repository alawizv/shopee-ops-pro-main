import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DeleteFileButtons({ 
  onDeleteRaw, 
  onDeleteOutput, 
  onPurgeAll,
  disabled = false 
}) {
  const [dialogOpen, setDialogOpen] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  
  const handleDelete = () => {
    if (confirmText !== 'DELETE') {
      return;
    }
    
    if (dialogOpen === 'raw') onDeleteRaw();
    if (dialogOpen === 'output') onDeleteOutput();
    if (dialogOpen === 'purge') onPurgeAll();
    
    setDialogOpen(null);
    setConfirmText('');
  };
  
  return (
    <>
      <div className="flex gap-2">
        <Button 
          onClick={() => setDialogOpen('raw')}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete Raw
        </Button>
        <Button 
          onClick={() => setDialogOpen('output')}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete Output
        </Button>
        <Button 
          onClick={() => setDialogOpen('purge')}
          disabled={disabled}
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          Purge Session
        </Button>
      </div>
      
      <AlertDialog open={dialogOpen !== null} onOpenChange={(open) => !open && setDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Konfirmasi Hapus File
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {dialogOpen === 'purge' 
                  ? 'Anda akan menghapus SEMUA file (raw + output) dari session ini. Tindakan ini tidak dapat dibatalkan!'
                  : `Anda akan menghapus file ${dialogOpen === 'raw' ? 'mentah (raw)' : 'hasil (output)'}. Tindakan ini tidak dapat dibatalkan!`
                }
              </p>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  Ketik <span className="font-bold text-red-600">DELETE</span> untuk konfirmasi:
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE'}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}