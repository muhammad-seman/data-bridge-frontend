'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Plus, Trash2, RefreshCw, Zap, AlertTriangle, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ColumnMatcher, 
  DataTypeDetector, 
  MappingGenerator 
} from '@/lib/column-mapping';
import { calculateSimilarity } from '@/lib/text-utils';
import { useAppStore } from '@/store';
import type { 
  ProcessedFile, 
  ColumnMapping, 
  ColumnSuggestion,
  DataType 
} from '@/types';

interface ColumnMappingInterfaceProps {
  sourceFiles: ProcessedFile[];
  onMappingComplete?: (mappings: ColumnMapping[]) => void;
}

interface MappingRow {
  id: string;
  sourceFileId: string;
  sourceColumn: string;
  targetColumn: string;
  confidence: number;
  dataTypeMatch: boolean;
  suggestions: ColumnSuggestion[];
  transform?: ColumnMapping['mappings'][0]['transform'];
  isCustom: boolean;
}

export function ColumnMappingInterface({ 
  sourceFiles, 
  onMappingComplete 
}: ColumnMappingInterfaceProps) {
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [targetSchema, setTargetSchema] = useState<string[]>([]);
  const [isGeneratingMappings, setIsGeneratingMappings] = useState(false);
  const [selectedJoinType, setSelectedJoinType] = useState<'inner' | 'left' | 'right' | 'full'>('inner');
  const [joinKey, setJoinKey] = useState<string>('');

  const { addMapping } = useAppStore();

  // Generate unified target schema from all files
  const unifiedSchema = useMemo(() => {
    const allColumns = new Set<string>();
    
    sourceFiles.forEach(file => {
      if (file.parsedData) {
        file.parsedData.headers.forEach(header => allColumns.add(header));
      }
    });
    
    return Array.from(allColumns).sort();
  }, [sourceFiles]);

  // Initialize with auto-generated mappings
  useEffect(() => {
    if (sourceFiles.length > 0 && targetSchema.length === 0) {
      setTargetSchema(unifiedSchema);
      generateAutoMappings();
    }
  }, [sourceFiles, unifiedSchema, targetSchema.length]);

  /**
   * Generate automatic column mappings using AI algorithms
   */
  const generateAutoMappings = async () => {
    setIsGeneratingMappings(true);
    
    try {
      const newMappingRows: MappingRow[] = [];
      
      for (const sourceFile of sourceFiles) {
        if (!sourceFile.parsedData) continue;
        
        const matcher = new ColumnMatcher(unifiedSchema);
        
        for (const sourceColumn of sourceFile.parsedData.headers) {
          const suggestions = matcher.findMatches(sourceColumn, 3);
          const bestMatch = suggestions[0];
          
          if (bestMatch && bestMatch.similarity > 0.5) {
            // Check data type compatibility
            const sourceColType = sourceFile.parsedData.columnTypes.find(c => c.name === sourceColumn);
            const targetColType = sourceFiles
              .flatMap(f => f.parsedData?.columnTypes || [])
              .find(c => c.name === bestMatch.targetColumn);
            
            const dataTypeMatch = sourceColType && targetColType 
              ? DataTypeDetector.areTypesCompatible(sourceColType.type, targetColType.type)
              : false;
            
            const mappingRow: MappingRow = {
              id: `${sourceFile.id}-${sourceColumn}-${Date.now()}`,
              sourceFileId: sourceFile.id,
              sourceColumn,
              targetColumn: bestMatch.targetColumn,
              confidence: bestMatch.similarity,
              dataTypeMatch,
              suggestions,
              transform: getRecommendedTransform(sourceColType?.type, targetColType?.type),
              isCustom: false
            };
            
            newMappingRows.push(mappingRow);
          }
        }
      }
      
      setMappingRows(newMappingRows);
    } catch (error) {
      console.error('Error generating auto mappings:', error);
    } finally {
      setIsGeneratingMappings(false);
    }
  };

  /**
   * Get recommended data transformation
   */
  const getRecommendedTransform = (
    sourceType?: DataType, 
    targetType?: DataType
  ): ColumnMapping['mappings'][0]['transform'] => {
    if (!sourceType || !targetType) return 'none';
    if (sourceType === targetType) return 'none';
    
    if (sourceType === 'date' && targetType === 'string') return 'date_format';
    if (sourceType === 'number' && targetType === 'string') return 'number_format';
    if (sourceType === 'string' && targetType === 'string') return 'lowercase';
    
    return 'none';
  };

  /**
   * Add new custom mapping row
   */
  const addCustomMapping = () => {
    const newRow: MappingRow = {
      id: `custom-${Date.now()}`,
      sourceFileId: sourceFiles[0]?.id || '',
      sourceColumn: '',
      targetColumn: '',
      confidence: 0,
      dataTypeMatch: false,
      suggestions: [],
      transform: 'none',
      isCustom: true
    };
    
    setMappingRows([...mappingRows, newRow]);
  };

  /**
   * Remove mapping row
   */
  const removeMapping = (id: string) => {
    setMappingRows(rows => rows.filter(row => row.id !== id));
  };

  /**
   * Update mapping row
   */
  const updateMapping = (id: string, updates: Partial<MappingRow>) => {
    setMappingRows(rows => rows.map(row => 
      row.id === id ? { ...row, ...updates } : row
    ));
  };

  /**
   * Apply suggestion to mapping
   */
  const applySuggestion = (rowId: string, suggestion: ColumnSuggestion) => {
    updateMapping(rowId, {
      targetColumn: suggestion.targetColumn,
      confidence: suggestion.similarity,
      suggestions: [suggestion]
    });
  };

  /**
   * Get file name by ID
   */
  const getFileName = (fileId: string): string => {
    return sourceFiles.find(f => f.id === fileId)?.name || 'Unknown File';
  };

  /**
   * Get available source columns for a file
   */
  const getSourceColumns = (fileId: string): string[] => {
    const file = sourceFiles.find(f => f.id === fileId);
    return file?.parsedData?.headers || [];
  };

  /**
   * Get confidence color
   */
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  /**
   * Generate final mappings
   */
  const generateFinalMappings = (): ColumnMapping[] => {
    const mappingsBySource = new Map<string, MappingRow[]>();
    
    // Group mappings by source file
    mappingRows.forEach(row => {
      if (row.sourceColumn && row.targetColumn) {
        const existing = mappingsBySource.get(row.sourceFileId) || [];
        mappingsBySource.set(row.sourceFileId, [...existing, row]);
      }
    });
    
    // Convert to ColumnMapping format
    const finalMappings: ColumnMapping[] = [];
    
    for (const [sourceFileId, rows] of mappingsBySource.entries()) {
      const mapping: ColumnMapping = {
        id: `mapping-${sourceFileId}-${Date.now()}`,
        sourceFileId,
        mappings: rows.map(row => ({
          sourceColumn: row.sourceColumn,
          targetColumn: row.targetColumn,
          transform: row.transform || 'none'
        })),
        joinType: selectedJoinType,
        joinKey: joinKey || undefined
      };
      
      finalMappings.push(mapping);
    }
    
    return finalMappings;
  };

  /**
   * Complete mapping process
   */
  const completeMappings = () => {
    const finalMappings = generateFinalMappings();
    
    // Add to store
    finalMappings.forEach(mapping => addMapping(mapping));
    
    // Notify parent
    onMappingComplete?.(finalMappings);
  };

  /**
   * Calculate overall mapping quality
   */
  const mappingQuality = useMemo(() => {
    if (mappingRows.length === 0) return 0;
    
    const totalConfidence = mappingRows.reduce((sum, row) => sum + row.confidence, 0);
    const dataTypeMatches = mappingRows.filter(row => row.dataTypeMatch).length;
    
    const avgConfidence = totalConfidence / mappingRows.length;
    const dataTypeScore = dataTypeMatches / mappingRows.length;
    
    return (avgConfidence * 0.7 + dataTypeScore * 0.3) * 100;
  }, [mappingRows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Column Mapping</h2>
          <p className="text-gray-600 mt-1">
            Map columns from your source files to create a unified dataset
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge 
            variant="outline" 
            className={`px-3 py-1 ${
              mappingQuality >= 80 ? 'bg-green-100 text-green-800' :
              mappingQuality >= 60 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}
          >
            Quality: {Math.round(mappingQuality)}%
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={generateAutoMappings}
            disabled={isGeneratingMappings}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingMappings ? 'animate-spin' : ''}`} />
            {isGeneratingMappings ? 'Generating...' : 'Auto-Map'}
          </Button>
        </div>
      </div>

      {/* Mapping Configuration */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Join Type
            </label>
            <Select value={selectedJoinType} onValueChange={(value: any) => setSelectedJoinType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inner">Inner Join</SelectItem>
                <SelectItem value="left">Left Join</SelectItem>
                <SelectItem value="right">Right Join</SelectItem>
                <SelectItem value="full">Full Join</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Join Key (Optional)
            </label>
            <Input
              placeholder="Select common column..."
              value={joinKey}
              onChange={(e) => setJoinKey(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Target Schema
            </label>
            <Badge variant="outline" className="px-3 py-1">
              {unifiedSchema.length} columns detected
            </Badge>
          </div>
        </div>
      </Card>

      {/* Mapping Table */}
      <Card>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Column Mappings</h3>
            <Button onClick={addCustomMapping} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Mapping
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-900">Source File</th>
                <th className="text-left p-4 font-medium text-gray-900">Source Column</th>
                <th className="text-center p-4 font-medium text-gray-900">Mapping</th>
                <th className="text-left p-4 font-medium text-gray-900">Target Column</th>
                <th className="text-left p-4 font-medium text-gray-900">Confidence</th>
                <th className="text-left p-4 font-medium text-gray-900">Transform</th>
                <th className="text-center p-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mappingRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="text-sm font-medium text-gray-900">
                      {getFileName(row.sourceFileId)}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    {row.isCustom ? (
                      <Select 
                        value={row.sourceColumn} 
                        onValueChange={(value) => updateMapping(row.id, { sourceColumn: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getSourceColumns(row.sourceFileId).map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{row.sourceColumn}</Badge>
                    )}
                  </td>
                  
                  <td className="p-4 text-center">
                    <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                  </td>
                  
                  <td className="p-4">
                    {row.isCustom ? (
                      <Select 
                        value={row.targetColumn} 
                        onValueChange={(value) => updateMapping(row.id, { targetColumn: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select target..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unifiedSchema.map((col) => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="default">{row.targetColumn}</Badge>
                        {row.suggestions.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {row.suggestions.slice(1, 3).map((suggestion, idx) => (
                              <Button
                                key={idx}
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => applySuggestion(row.id, suggestion)}
                              >
                                {suggestion.targetColumn} ({Math.round(suggestion.similarity * 100)}%)
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={`${getConfidenceColor(row.confidence)} text-xs`}
                      >
                        {Math.round(row.confidence * 100)}%
                      </Badge>
                      {row.dataTypeMatch ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <Select 
                      value={row.transform || 'none'} 
                      onValueChange={(value: any) => updateMapping(row.id, { transform: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="lowercase">Lowercase</SelectItem>
                        <SelectItem value="uppercase">Uppercase</SelectItem>
                        <SelectItem value="date_format">Date Format</SelectItem>
                        <SelectItem value="number_format">Number Format</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  
                  <td className="p-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMapping(row.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {mappingRows.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No column mappings yet.</p>
              <p className="text-sm">Click &quot;Auto-Map&quot; to generate suggestions automatically.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Summary & Actions */}
      {mappingRows.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                {mappingRows.length} mappings configured across {sourceFiles.length} files
              </p>
              <p className="text-xs text-gray-500">
                Quality score: {Math.round(mappingQuality)}% • 
                {mappingRows.filter(r => r.dataTypeMatch).length} type matches • 
                {mappingRows.filter(r => r.confidence >= 0.8).length} high confidence
              </p>
            </div>
            
            <div className="flex space-x-3">
              <Button variant="outline">
                Preview Result
              </Button>
              <Button onClick={completeMappings}>
                Apply Mappings
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}