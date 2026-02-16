import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Files } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function MultiFileUploader({ 
  onFilesSelect, 
  files = [],
  onRemoveFile,
  accept = ".xlsx,.csv",
  maxSize = 50,
  maxFiles = 10,
  disabled = false,
  className 
}) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef(null);
  
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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [files, maxFiles]);
  
  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };
  
  const handleFiles = (newFiles) => {
    const validFiles = [];
    
    for (const file of newFiles) {
      if (files.length + validFiles.length >= maxFiles) {
        alert(`Maksimal ${maxFiles} file`);
        break;
      }
      
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSize) {
        alert(`File "${file.name}" terlalu besar! Maksimal ${maxSize}MB per file`);
        continue;
      }
      
      // Check if file already added
      const exists = files.some(f => f.name === file.name && f.size === file.size);
      if (exists) {
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      onFilesSelect([...files, ...validFiles]);
    }
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      <Card className={cn("p-6 border-2 border-dashed transition-all", 
        dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400",
        disabled && "opacity-50 cursor-not-allowed"
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
            <Files className="w-8 h-8 text-slate-400" />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              Drag & drop file atau <label htmlFor="multi-file-upload" className="text-blue-600 cursor-pointer hover:underline">browse</label>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Maksimal {maxFiles} file • {maxSize}MB per file • Format: {accept}
            </p>
          </div>
          
          <input
            id="multi-file-upload"
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleChange}
            disabled={disabled}
            multiple
          />
          
          <Button 
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || files.length >= maxFiles}
          >
            <Upload className="w-4 h-4 mr-2" />
            Pilih File ({files.length}/{maxFiles})
          </Button>
        </form>
      </Card>
      
      {/* File List */}
      {files.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">
            File yang dipilih ({files.length})
          </p>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveFile(index)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}