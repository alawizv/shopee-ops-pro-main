import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Trash2, FileText, FileSpreadsheet, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function OutputFilesList() {
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['processedFiles'],
    queryFn: () => base44.entities.ProcessedFile.list('-created_date', 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProcessedFile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['processedFiles']);
      toast.success('Output berhasil dihapus');
      setDeleteTarget(null);
    },
  });

  const handleDelete = (file) => {
    setDeleteTarget(file);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generated Outputs</CardTitle>
          <p className="text-sm text-slate-600">File tersimpan selama 24 jam</p>
        </CardHeader>
        <CardContent className="text-center py-12 text-slate-500">
          Belum ada file yang diproses
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Generated Outputs
            <span className="text-sm font-normal text-slate-600 ml-2">
              (tersimpan 24 jam)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu Proses</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>File Input</TableHead>
                  <TableHead className="text-right">Rows In</TableHead>
                  <TableHead className="text-right">Rows Out</TableHead>
                  <TableHead>Output Files</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const isExpired = new Date(file.expires_at) < new Date();
                  return (
                    <TableRow key={file.id} className={isExpired ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {format(new Date(file.created_date), 'dd MMM yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          file.file_type === 'order' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {file.file_type === 'order' ? 'Orders' : 'Income'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {file.original_filename}
                      </TableCell>
                      <TableCell className="text-right">
                        {file.stats?.input_rows || 0}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {file.stats?.output_rows || 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {file.output_csv_url && !isExpired && (
                            <a
                              href={file.output_csv_url}
                              download
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              CSV
                            </a>
                          )}
                          {file.output_excel_url && !isExpired && (
                            <a
                              href={file.output_excel_url}
                              download
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              Excel
                            </a>
                          )}
                          {isExpired && (
                            <span className="text-xs text-red-600 font-medium">Expired</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Output File?</AlertDialogTitle>
            <AlertDialogDescription>
              File output dan metadata akan dihapus permanen. Raw file tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}