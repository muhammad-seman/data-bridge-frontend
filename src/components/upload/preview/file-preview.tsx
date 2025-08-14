'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, FileText, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatFileSize } from '@/lib/file-utils';
import type { ProcessedFile, DataType } from '@/types';

interface FilePreviewProps {
  file: ProcessedFile;
  maxRows?: number;
  onSelect?: (fileId: string) => void;
  isSelected?: boolean;
}

export function FilePreview({ 
  file, 
  maxRows = 10, 
  onSelect,
  isSelected = false 
}: FilePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const { parsedData } = file;
  
  if (!parsedData) {
    return null;
  }

  const { headers, rows, rowCount, columnTypes } = parsedData;
  
  // Pagination logic
  const totalPages = Math.ceil(Math.min(rows.length, 1000) / maxRows); // Limit to first 1000 rows for preview
  const startIndex = currentPage * maxRows;
  const endIndex = Math.min(startIndex + maxRows, rows.length);
  const currentRows = rows.slice(startIndex, endIndex);

  // Column type color mapping
  const getTypeColor = (type: DataType) => {
    switch (type) {
      case 'number': return 'bg-blue-100 text-blue-800';
      case 'date': return 'bg-green-100 text-green-800';
      case 'string': return 'bg-gray-100 text-gray-800';
      case 'boolean': return 'bg-purple-100 text-purple-800';
      case 'mixed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  // File statistics
  const stats = useMemo(() => {
    if (!parsedData) {
      return {
        columns: 0,
        rows: 0,
        dataCompleteness: 0,
        uniqueColumns: 0,
      };
    }

    const nullCounts = columnTypes.map(col => col.nullCount);
    const totalNulls = nullCounts.reduce((sum, count) => sum + count, 0);
    const totalCells = headers.length * rowCount;
    const dataCompleteness = totalCells > 0 ? ((totalCells - totalNulls) / totalCells * 100) : 0;
    
    return {
      columns: headers.length,
      rows: rowCount,
      dataCompleteness: Math.round(dataCompleteness * 10) / 10,
      uniqueColumns: columnTypes.filter(col => col.uniqueCount === rowCount).length,
    };
  }, [parsedData, columnTypes, headers.length, rowCount]);

  return (
    <Card className={`${isSelected ? 'ring-2 ring-blue-500 border-blue-200' : ''}`}>
      {/* File Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {file.name}
                </h3>
                {file.status === 'ready' && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Ready
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{stats.columns} columns</span>
                <span>•</span>
                <span>{stats.rows.toLocaleString()} rows</span>
                <span>•</span>
                <span>{stats.dataCompleteness}% complete</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {onSelect && (
              <Button
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onSelect(file.id)}
              >
                {isSelected ? 'Selected' : 'Select'}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Hide Preview
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-1" />
                  <Eye className="w-4 h-4 mr-1" />
                  Preview Data
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Total Columns</div>
              <div className="text-lg font-semibold text-gray-900">{stats.columns}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Total Rows</div>
              <div className="text-lg font-semibold text-gray-900">{stats.rows.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Data Quality</div>
              <div className="text-lg font-semibold text-gray-900">{stats.dataCompleteness}%</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Unique Cols</div>
              <div className="text-lg font-semibold text-gray-900">{stats.uniqueColumns}</div>
            </div>
          </div>

          {/* Column Types */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Column Types</h4>
            <div className="flex flex-wrap gap-2">
              {columnTypes.map((col, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Badge variant="outline" className={`${getTypeColor(col.type)} text-xs`}>
                    {col.name}: {col.type}
                  </Badge>
                  {col.confidence < 0.8 && (
                    <span className="text-xs text-orange-600">(?)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Data Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">
                Data Preview ({startIndex + 1}-{endIndex} of {Math.min(rows.length, 1000)})
              </h4>
              
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12 text-xs">#</TableHead>
                      {headers.map((header, index) => {
                        const colType = columnTypes[index];
                        return (
                          <TableHead key={index} className="min-w-32">
                            <div className="space-y-1">
                              <div className="font-medium text-gray-900">{header}</div>
                              <Badge 
                                variant="secondary" 
                                className={`${getTypeColor(colType.type)} text-xs`}
                              >
                                {colType.type}
                                {colType.confidence < 0.8 && ' ?'}
                              </Badge>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRows.map((row, rowIndex) => (
                      <TableRow key={startIndex + rowIndex} className="hover:bg-gray-50">
                        <TableCell className="text-xs text-gray-500 font-mono">
                          {startIndex + rowIndex + 1}
                        </TableCell>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="text-sm">
                            <div className="max-w-32 truncate" title={formatCellValue(cell)}>
                              {cell === null ? (
                                <span className="text-gray-400 italic">null</span>
                              ) : (
                                formatCellValue(cell)
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-gray-500">
              {file.hasHeader ? 'Header row detected' : 'No header row'} • 
              {file.encoding && ` ${file.encoding.toUpperCase()} encoding`}
              {file.delimiter && ` • "${file.delimiter}" delimiter`}
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-1" />
                Quick Stats
              </Button>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}