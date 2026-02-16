import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function FileUploader({ 
  onFileSelect, 
  accept = ".xlsx,.csv",
  maxSize = 50,
  disabled = false,
  className 
}) {
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);
  
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };
  
  const handleFile = (file) => {
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxSize) {
      alert(`File terlalu besar! Maksimal ${maxSize}MB`);
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  };
  
  return (
    <Card className={cn("p-8 border-2 border-dashed transition-all", 
      dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <form 
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="flex flex-col items-center gap-4"
      >
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
          dragActive ? "bg-blue-100" : "bg-slate-100"
        )}>
          {selectedFile ? (
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
          ) : (
            <Upload className="w-8 h-8 text-slate-400" />
          )}
        </div>
        
        <div className="text-center">
          {selectedFile ? (
            <>
              <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Drag & drop file atau <label htmlFor="file-upload" className="text-blue-600 cursor-pointer hover:underline">browse</label>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Maksimal {maxSize}MB • Format: {accept}
              </p>
            </>
          )}
        </div>
        
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
          disabled={disabled}
        />
      </form>
    </Card>
  );
}