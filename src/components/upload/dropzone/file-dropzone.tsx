'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { validateFile, formatFileSize, createUploadedFile, processFile } from '@/lib/file-utils';
import { useAppStore } from '@/store';
import type { UploadedFile } from '@/types';

interface FileDropzoneProps {
  maxFiles?: number;
  maxSize?: number; // in bytes
  onFilesProcessed?: (files: UploadedFile[]) => void;
}

export function FileDropzone({ 
  maxFiles = 5, 
  maxSize = 10 * 1024 * 1024,
  onFilesProcessed 
}: FileDropzoneProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);
  
  const { files, addFiles, updateFile } = useAppStore();

  const processUploadedFile = useCallback(async (uploadedFile: UploadedFile) => {
    setProcessingFiles(prev => [...prev, uploadedFile.id]);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[uploadedFile.id] || 0;
          const next = Math.min(current + Math.random() * 20, 90);
          
          if (next >= 90) {
            clearInterval(progressInterval);
          }
          
          return { ...prev, [uploadedFile.id]: next };
        });
      }, 100);

      // Process the file
      const processedFile = await processFile(uploadedFile);
      
      // Complete progress
      setUploadProgress(prev => ({ ...prev, [uploadedFile.id]: 100 }));
      
      // Update file in store
      updateFile(uploadedFile.id, processedFile);
      
      // Clean up
      setTimeout(() => {
        setUploadProgress(prev => {
          const { [uploadedFile.id]: _, ...rest } = prev;
          return rest;
        });
        setProcessingFiles(prev => prev.filter(id => id !== uploadedFile.id));
      }, 1000);
      
    } catch (error) {
      updateFile(uploadedFile.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Processing failed'
      });
      
      setProcessingFiles(prev => prev.filter(id => id !== uploadedFile.id));
      setUploadProgress(prev => {
        const { [uploadedFile.id]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [updateFile]);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: unknown[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      console.warn('Rejected files:', rejectedFiles);
    }

    // Validate and process accepted files
    const validFiles: UploadedFile[] = [];
    const invalidFiles: { file: File; errors: string[] }[] = [];

    for (const file of acceptedFiles) {
      const validation = validateFile(file);
      
      if (validation.isValid) {
        const uploadedFile = createUploadedFile(file);
        validFiles.push(uploadedFile);
      } else {
        invalidFiles.push({ file, errors: validation.errors });
      }
    }

    if (invalidFiles.length > 0) {
      // Handle invalid files - you might want to show a toast notification here
      console.warn('Invalid files:', invalidFiles);
    }

    // Add valid files to store as basic uploads first
    if (validFiles.length > 0) {
      // Convert to ProcessedFile format (without parsedData initially)
      const processedFiles = validFiles.map(file => ({
        ...file,
        parsedData: null as any, // Will be filled during processing
        hasHeader: true, // Default assumption
        status: 'uploading' as const
      }));
      
      addFiles(processedFiles);
      onFilesProcessed?.(validFiles);
      
      // Process each file
      validFiles.forEach(processUploadedFile);
    }
  }, [addFiles, onFilesProcessed, processUploadedFile]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    isDragAccept,
  } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles,
    maxSize,
    multiple: true,
  });

  const removeFile = (fileId: string) => {
    // This will be handled by the parent component or store action
    console.log('Remove file:', fileId);
  };

  const canUploadMore = files.length < maxFiles;

  return (
    <div className="w-full space-y-4">
      {/* Dropzone Area */}
      <Card 
        {...getRootProps()} 
        className={`
          relative border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${isDragAccept ? 'border-green-400 bg-green-50' : ''}
          ${!canUploadMore ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} disabled={!canUploadMore} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={`
            p-4 rounded-full 
            ${isDragActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
            ${isDragReject ? 'bg-red-100 text-red-600' : ''}
            ${isDragAccept ? 'bg-green-100 text-green-600' : ''}
          `}>
            <Upload className="w-8 h-8" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isDragActive ? 'Drop files here' : 'Upload your data files'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {canUploadMore 
                ? `Drag & drop CSV or Excel files, or click to browse (${files.length}/${maxFiles} files)`
                : 'Maximum number of files reached'
              }
            </p>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span>Supported formats: CSV, XLS, XLSX</span>
            <span>•</span>
            <span>Max size: {formatFileSize(maxSize)}</span>
          </div>
          
          {canUploadMore && (
            <Button variant="outline" size="sm" type="button">
              Browse Files
            </Button>
          )}
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-gray-900 mb-3">Uploaded Files ({files.length})</h4>
          
          <div className="space-y-3">
            {files.map((file) => {
              const isProcessing = processingFiles.includes(file.id);
              const progress = uploadProgress[file.id] || 0;
              
              return (
                <div key={file.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <File className="w-5 h-5 text-gray-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {file.status === 'error' && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </Badge>
                        )}
                        
                        {file.status === 'ready' && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ready
                          </Badge>
                        )}
                        
                        {file.status === 'processing' && (
                          <Badge variant="secondary" className="text-xs">
                            Processing...
                          </Badge>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    
                    {/* Progress bar for processing files */}
                    {isProcessing && (
                      <div className="mt-2">
                        <Progress value={progress} className="h-1" />
                        <p className="text-xs text-gray-500 mt-1">
                          Processing... {Math.round(progress)}%
                        </p>
                      </div>
                    )}
                    
                    {/* Error message */}
                    {file.status === 'error' && file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}