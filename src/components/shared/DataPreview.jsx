import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DataPreview({ data, maxRows = 50, title = "Preview Data" }) {
  if (!data || data.length === 0) {
    return null;
  }
  
  const displayData = data.slice(0, maxRows);
  const columns = Object.keys(displayData[0]);
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b bg-slate-50">
        <CardTitle className="text-lg font-semibold text-slate-900">
          {title}
          <span className="text-sm font-normal text-slate-500 ml-2">
            (Menampilkan {displayData.length} dari {data.length} baris)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-100 z-10">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="font-semibold text-slate-700 whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                    {columns.map((col) => (
                      <TableCell key={col} className="text-sm text-slate-700 whitespace-nowrap">
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}