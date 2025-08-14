import { format, parseISO } from 'date-fns';
import { groupBy, isEqual, orderBy } from 'lodash';
import type { 
  ProcessedFile, 
  ColumnMapping, 
  ProcessedDataset,
  DataType 
} from '@/types';

/**
 * Data merging and transformation utilities
 */

export interface MergeOptions {
  joinType: 'inner' | 'left' | 'right' | 'full';
  joinKey?: string;
  handleDuplicates: 'keep_first' | 'keep_last' | 'merge_values';
  validateTypes: boolean;
  maxRows?: number;
}

export interface MergeResult {
  dataset: ProcessedDataset;
  stats: {
    totalRows: number;
    mergedRows: number;
    droppedRows: number;
    duplicateRows: number;
    nullValues: number;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Data transformer for applying column mappings
 */
export class DataTransformer {
  /**
   * Transform data according to mapping configuration
   */
  static transformData(
    data: (string | number | Date | null)[][],
    headers: string[],
    mapping: ColumnMapping['mappings']
  ): { headers: string[]; data: (string | number | Date | null)[][] } {
    const transformedHeaders: string[] = [];
    const columnIndexMap = new Map<string, number>();
    
    // Build column index map
    headers.forEach((header, index) => {
      columnIndexMap.set(header, index);
    });
    
    // Create new headers based on mapping
    const mappingMap = new Map<string, ColumnMapping['mappings'][0]>();
    mapping.forEach(map => {
      mappingMap.set(map.sourceColumn, map);
      transformedHeaders.push(map.targetColumn);
    });
    
    // Transform data rows
    const transformedData = data.map(row => {
      const newRow: (string | number | Date | null)[] = [];
      
      mapping.forEach(map => {
        const sourceIndex = columnIndexMap.get(map.sourceColumn);
        let value = sourceIndex !== undefined ? row[sourceIndex] : null;
        
        // Apply transformation
        if (value !== null && map.transform) {
          value = this.applyTransformation(value, map.transform, map.transformParams);
        }
        
        newRow.push(value);
      });
      
      return newRow;
    });
    
    return {
      headers: transformedHeaders,
      data: transformedData
    };
  }

  /**
   * Apply specific transformation to a value
   */
  private static applyTransformation(
    value: string | number | Date | null,
    transform: ColumnMapping['mappings'][0]['transform'],
    params?: Record<string, string | number | boolean>
  ): string | number | Date | null {
    if (value === null) return null;
    
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
        
      case 'lowercase':
        return String(value).toLowerCase();
        
      case 'date_format':
        if (value instanceof Date) {
          const formatString = (params?.format as string) || 'yyyy-MM-dd';
          return format(value, formatString);
        }
        if (typeof value === 'string') {
          try {
            const date = parseISO(value);
            const formatString = (params?.format as string) || 'yyyy-MM-dd';
            return format(date, formatString);
          } catch {
            return value;
          }
        }
        return String(value);
        
      case 'number_format':
        if (typeof value === 'number') {
          const decimals = (params?.decimals as number) || 2;
          return Number(value.toFixed(decimals));
        }
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            const decimals = (params?.decimals as number) || 2;
            return Number(num.toFixed(decimals));
          }
        }
        return value;
        
      case 'none':
      default:
        return value;
    }
  }
}

/**
 * Data merger for combining multiple datasets
 */
export class DataMerger {
  /**
   * Merge multiple files according to their column mappings
   */
  static async mergeFiles(
    files: ProcessedFile[],
    mappings: ColumnMapping[],
    options: MergeOptions
  ): Promise<MergeResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    try {
      // Validate inputs
      if (files.length === 0) {
        throw new Error('No files provided for merging');
      }
      
      if (mappings.length === 0) {
        throw new Error('No column mappings provided');
      }
      
      // Transform each file according to its mapping
      const transformedFiles: Array<{
        file: ProcessedFile;
        headers: string[];
        data: (string | number | Date | null)[][];
      }> = [];
      
      for (const mapping of mappings) {
        const file = files.find(f => f.id === mapping.sourceFileId);
        if (!file || !file.parsedData) {
          warnings.push(`File ${mapping.sourceFileId} not found or has no data`);
          continue;
        }
        
        const transformed = DataTransformer.transformData(
          file.parsedData.rows,
          file.parsedData.headers,
          mapping.mappings
        );
        
        transformedFiles.push({
          file,
          headers: transformed.headers,
          data: transformed.data
        });
      }
      
      if (transformedFiles.length === 0) {
        throw new Error('No valid files to merge after transformation');
      }
      
      // Create unified schema
      const unifiedHeaders = this.createUnifiedSchema(transformedFiles.map(tf => tf.headers));
      
      // Merge data
      const mergeResult = await this.performMerge(transformedFiles, unifiedHeaders, options);
      
      // Create dataset
      const dataset: ProcessedDataset = {
        id: `merged-${Date.now()}`,
        name: `Merged Dataset (${files.length} files)`,
        sourceFiles: files.map(f => f.id),
        headers: unifiedHeaders,
        data: this.convertToRecordFormat(mergeResult.data, unifiedHeaders),
        columnTypes: this.detectColumnTypes(mergeResult.data, unifiedHeaders),
        createdAt: new Date(),
        rowCount: mergeResult.data.length
      };
      
      return {
        dataset,
        stats: mergeResult.stats,
        warnings,
        errors
      };
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown merge error');
      
      // Return empty dataset on error
      return {
        dataset: {
          id: `error-${Date.now()}`,
          name: 'Failed Merge',
          sourceFiles: files.map(f => f.id),
          headers: [],
          data: [],
          columnTypes: [],
          createdAt: new Date(),
          rowCount: 0
        },
        stats: {
          totalRows: 0,
          mergedRows: 0,
          droppedRows: 0,
          duplicateRows: 0,
          nullValues: 0
        },
        warnings,
        errors
      };
    }
  }

  /**
   * Create unified schema from multiple file schemas
   */
  private static createUnifiedSchema(schemas: string[][]): string[] {
    const columnCounts = new Map<string, number>();
    
    // Count occurrences of each column
    schemas.forEach(schema => {
      schema.forEach(column => {
        columnCounts.set(column, (columnCounts.get(column) || 0) + 1);
      });
    });
    
    // Sort by frequency and alphabetically
    return Array.from(columnCounts.keys()).sort((a, b) => {
      const countDiff = (columnCounts.get(b) || 0) - (columnCounts.get(a) || 0);
      return countDiff !== 0 ? countDiff : a.localeCompare(b);
    });
  }

  /**
   * Perform the actual data merge
   */
  private static async performMerge(
    transformedFiles: Array<{
      file: ProcessedFile;
      headers: string[];
      data: (string | number | Date | null)[][];
    }>,
    unifiedHeaders: string[],
    options: MergeOptions
  ): Promise<{
    data: (string | number | Date | null)[][];
    stats: MergeResult['stats'];
  }> {
    let mergedData: (string | number | Date | null)[][] = [];
    let totalRows = 0;
    let droppedRows = 0;
    let duplicateRows = 0;
    let nullValues = 0;
    
    if (options.joinType === 'inner' || options.joinType === 'left') {
      // Start with the first file as base
      const baseFile = transformedFiles[0];
      mergedData = this.alignDataToSchema(baseFile.data, baseFile.headers, unifiedHeaders);
      totalRows += baseFile.data.length;
      
      // Merge remaining files
      for (let i = 1; i < transformedFiles.length; i++) {
        const currentFile = transformedFiles[i];
        const alignedData = this.alignDataToSchema(
          currentFile.data, 
          currentFile.headers, 
          unifiedHeaders
        );
        
        if (options.joinKey) {
          // Join based on key
          const joinResult = this.performKeyBasedJoin(
            mergedData,
            alignedData,
            unifiedHeaders,
            options.joinKey,
            options.joinType
          );
          mergedData = joinResult.data;
          droppedRows += joinResult.droppedRows;
        } else {
          // Append data (union)
          mergedData = [...mergedData, ...alignedData];
        }
        
        totalRows += currentFile.data.length;
      }
    } else {
      // For right and full joins, concatenate all data
      for (const file of transformedFiles) {
        const alignedData = this.alignDataToSchema(file.data, file.headers, unifiedHeaders);
        mergedData = [...mergedData, ...alignedData];
        totalRows += file.data.length;
      }
    }
    
    // Handle duplicates
    if (options.handleDuplicates !== 'keep_first') {
      const dedupeResult = this.handleDuplicates(mergedData, options.handleDuplicates);
      mergedData = dedupeResult.data;
      duplicateRows = dedupeResult.duplicatesRemoved;
    }
    
    // Count null values
    nullValues = mergedData.reduce((count, row) => 
      count + row.filter(cell => cell === null).length, 0
    );
    
    // Apply row limit if specified
    if (options.maxRows && mergedData.length > options.maxRows) {
      mergedData = mergedData.slice(0, options.maxRows);
      droppedRows += totalRows - options.maxRows;
    }
    
    return {
      data: mergedData,
      stats: {
        totalRows,
        mergedRows: mergedData.length,
        droppedRows,
        duplicateRows,
        nullValues
      }
    };
  }

  /**
   * Align data to unified schema
   */
  private static alignDataToSchema(
    data: (string | number | Date | null)[][],
    currentHeaders: string[],
    unifiedHeaders: string[]
  ): (string | number | Date | null)[][] {
    const headerIndexMap = new Map<string, number>();
    currentHeaders.forEach((header, index) => {
      headerIndexMap.set(header, index);
    });
    
    return data.map(row => {
      return unifiedHeaders.map(header => {
        const index = headerIndexMap.get(header);
        return index !== undefined ? row[index] : null;
      });
    });
  }

  /**
   * Perform key-based join between datasets
   */
  private static performKeyBasedJoin(
    leftData: (string | number | Date | null)[][],
    rightData: (string | number | Date | null)[][],
    headers: string[],
    joinKey: string,
    joinType: 'inner' | 'left' | 'right' | 'full'
  ): { data: (string | number | Date | null)[][]; droppedRows: number } {
    const joinKeyIndex = headers.indexOf(joinKey);
    if (joinKeyIndex === -1) {
      // If join key not found, fallback to append
      return { data: [...leftData, ...rightData], droppedRows: 0 };
    }
    
    // Create lookup maps
    const leftMap = new Map<string, (string | number | Date | null)[]>();
    const rightMap = new Map<string, (string | number | Date | null)[]>();
    
    leftData.forEach(row => {
      const key = String(row[joinKeyIndex] || '');
      leftMap.set(key, row);
    });
    
    rightData.forEach(row => {
      const key = String(row[joinKeyIndex] || '');
      rightMap.set(key, row);
    });
    
    const result: (string | number | Date | null)[][] = [];
    const processedKeys = new Set<string>();
    let droppedRows = 0;
    
    // Process based on join type
    switch (joinType) {
      case 'inner':
        for (const [key, leftRow] of leftMap) {
          if (rightMap.has(key)) {
            const rightRow = rightMap.get(key)!;
            result.push(this.mergeRows(leftRow, rightRow, headers));
            processedKeys.add(key);
          } else {
            droppedRows++;
          }
        }
        break;
        
      case 'left':
        for (const [key, leftRow] of leftMap) {
          const rightRow = rightMap.get(key) || null;
          result.push(this.mergeRows(leftRow, rightRow, headers));
          processedKeys.add(key);
        }
        break;
        
      case 'right':
        for (const [key, rightRow] of rightMap) {
          const leftRow = leftMap.get(key) || null;
          result.push(this.mergeRows(leftRow, rightRow, headers));
          processedKeys.add(key);
        }
        break;
        
      case 'full':
        // Include all rows from both sides
        for (const [key, leftRow] of leftMap) {
          const rightRow = rightMap.get(key) || null;
          result.push(this.mergeRows(leftRow, rightRow, headers));
          processedKeys.add(key);
        }
        
        for (const [key, rightRow] of rightMap) {
          if (!processedKeys.has(key)) {
            result.push(this.mergeRows(null, rightRow, headers));
          }
        }
        break;
    }
    
    return { data: result, droppedRows };
  }

  /**
   * Merge two rows (for joins)
   */
  private static mergeRows(
    leftRow: (string | number | Date | null)[] | null,
    rightRow: (string | number | Date | null)[] | null,
    headers: string[]
  ): (string | number | Date | null)[] {
    const result: (string | number | Date | null)[] = new Array(headers.length).fill(null);
    
    if (leftRow) {
      leftRow.forEach((value, index) => {
        if (index < result.length) {
          result[index] = value;
        }
      });
    }
    
    if (rightRow) {
      rightRow.forEach((value, index) => {
        if (index < result.length && result[index] === null) {
          result[index] = value;
        }
      });
    }
    
    return result;
  }

  /**
   * Handle duplicate rows
   */
  private static handleDuplicates(
    data: (string | number | Date | null)[][],
    strategy: 'keep_first' | 'keep_last' | 'merge_values'
  ): { data: (string | number | Date | null)[][]; duplicatesRemoved: number } {
    if (strategy === 'keep_first') {
      return { data, duplicatesRemoved: 0 };
    }
    
    const seen = new Map<string, number>();
    const result: (string | number | Date | null)[][] = [];
    let duplicatesRemoved = 0;
    
    data.forEach((row, index) => {
      const key = JSON.stringify(row);
      
      if (seen.has(key)) {
        duplicatesRemoved++;
        if (strategy === 'keep_last') {
          // Replace previous occurrence
          const prevIndex = seen.get(key)!;
          result[prevIndex] = row;
        }
        // For merge_values, we would need more complex logic
      } else {
        seen.set(key, result.length);
        result.push(row);
      }
    });
    
    return { data: result, duplicatesRemoved };
  }

  /**
   * Convert array format to record format
   */
  private static convertToRecordFormat(
    data: (string | number | Date | null)[][],
    headers: string[]
  ): Record<string, string | number | Date | boolean | null>[] {
    return data.map(row => {
      const record: Record<string, string | number | Date | boolean | null> = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  /**
   * Detect column types for the merged dataset
   */
  private static detectColumnTypes(
    data: (string | number | Date | null)[][],
    headers: string[]
  ): Array<{ name: string; type: DataType; confidence: number; samples: any[]; nullCount: number; uniqueCount: number }> {
    return headers.map((header, index) => {
      const columnData = data.map(row => row[index]).filter(val => val !== null);
      const samples = columnData.slice(0, 10);
      
      // Simple type detection
      let type: DataType = 'string';
      let confidence = 1.0;
      
      if (columnData.length === 0) {
        type = 'unknown';
        confidence = 0;
      } else {
        const numberCount = columnData.filter(val => typeof val === 'number').length;
        const dateCount = columnData.filter(val => val instanceof Date).length;
        const stringCount = columnData.filter(val => typeof val === 'string').length;
        
        if (numberCount / columnData.length > 0.8) {
          type = 'number';
          confidence = numberCount / columnData.length;
        } else if (dateCount / columnData.length > 0.8) {
          type = 'date';
          confidence = dateCount / columnData.length;
        } else if (stringCount / columnData.length > 0.8) {
          type = 'string';
          confidence = stringCount / columnData.length;
        } else {
          type = 'mixed';
          confidence = 0.5;
        }
      }
      
      return {
        name: header,
        type,
        confidence,
        samples,
        nullCount: data.length - columnData.length,
        uniqueCount: new Set(columnData).size
      };
    });
  }
}