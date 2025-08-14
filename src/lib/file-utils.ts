import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { 
  UploadedFile, 
  ProcessedFile, 
  ParsedData, 
  FileParseOptions,
  DataType,
  ColumnType 
} from '@/types';

// File validation
export const validateFile = (file: File): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const maxSize = 10 * 1024 * 1024; // 10MB
  const supportedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (file.size > maxSize) {
    errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (10MB)`);
  }

  if (!supportedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
    errors.push('Unsupported file format. Only CSV and Excel files are allowed.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// File size formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Convert File to UploadedFile
export const createUploadedFile = (file: File): UploadedFile => ({
  id: generateId(),
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
  content: file,
  status: 'uploading',
});

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Parse CSV file
export const parseCSVFile = async (
  file: File, 
  options: FileParseOptions = {}
): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: options.delimiter || '',
      encoding: options.encoding || 'utf-8',
      complete: (results) => {
        try {
          const rawData = results.data as string[][];
          
          // Handle header detection
          const hasHeader = options.hasHeader ?? detectHeader(rawData);
          const headers = hasHeader ? rawData[0] : generateHeaders(rawData[0]?.length || 0);
          const rows = hasHeader ? rawData.slice(1) : rawData;
          
          // Skip rows if specified
          const processedRows = options.skipRows ? rows.slice(options.skipRows) : rows;
          
          // Limit rows if specified
          const finalRows = options.maxRows 
            ? processedRows.slice(0, options.maxRows) 
            : processedRows;

          // Convert string data to appropriate types
          const typedRows = convertDataTypes(finalRows);
          
          // Detect column types
          const columnTypes = detectColumnTypes(headers, typedRows);

          resolve({
            headers,
            rows: typedRows,
            rowCount: finalRows.length,
            columnTypes,
          });
        } catch (error) {
          reject(error);
        }
      },
      error: reject,
    });
  });
};

// Parse Excel file
export const parseExcelFile = async (
  file: File, 
  options: FileParseOptions = {}
): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: null,
          raw: false 
        }) as (string | number | null)[][];

        // Handle header detection
        const hasHeader = options.hasHeader ?? detectHeader(jsonData);
        const headers = hasHeader 
          ? jsonData[0].map(String) 
          : generateHeaders(jsonData[0]?.length || 0);
        const rows = hasHeader ? jsonData.slice(1) : jsonData;
        
        // Skip rows if specified
        const processedRows = options.skipRows ? rows.slice(options.skipRows) : rows;
        
        // Limit rows if specified
        const finalRows = options.maxRows 
          ? processedRows.slice(0, options.maxRows) 
          : processedRows;

        // Convert data types
        const typedRows = convertDataTypes(finalRows);
        
        // Detect column types
        const columnTypes = detectColumnTypes(headers, typedRows);

        resolve({
          headers,
          rows: typedRows,
          rowCount: finalRows.length,
          columnTypes,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
};

// Detect if first row is header
const detectHeader = (data: (string | number | null)[][]): boolean => {
  if (!data || data.length < 2) return true;
  
  const firstRow = data[0];
  const secondRow = data[1];
  
  // Check if first row has more strings than second row
  const firstRowStringCount = firstRow.filter(cell => 
    typeof cell === 'string' && isNaN(Number(cell))
  ).length;
  
  const secondRowStringCount = secondRow.filter(cell => 
    typeof cell === 'string' && isNaN(Number(cell))
  ).length;
  
  return firstRowStringCount > secondRowStringCount;
};

// Generate default headers
const generateHeaders = (columnCount: number): string[] => {
  return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
};

// Convert string data to appropriate types
const convertDataTypes = (rows: (string | number | null)[][]): (string | number | Date | null)[][] => {
  return rows.map(row => 
    row.map(cell => {
      if (cell === null || cell === undefined || cell === '') {
        return null;
      }
      
      const str = String(cell).trim();
      
      // Try to convert to number
      const num = Number(str);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
      
      // Try to convert to date
      const date = new Date(str);
      if (date instanceof Date && !isNaN(date.getTime())) {
        // Only convert if it looks like a date
        if (str.match(/^\d{4}-\d{2}-\d{2}/) || str.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
          return date;
        }
      }
      
      return str;
    })
  );
};

// Detect column data types
const detectColumnTypes = (
  headers: string[], 
  rows: (string | number | Date | null)[][]
): ColumnType[] => {
  return headers.map((header, index) => {
    const columnData = rows.map(row => row[index]).filter(cell => cell !== null);
    const samples = columnData.slice(0, 10); // Take first 10 non-null values as samples
    
    // Count types
    const typeCounts = {
      string: 0,
      number: 0,
      date: 0,
      boolean: 0,
    };
    
    columnData.forEach(value => {
      if (typeof value === 'string') typeCounts.string++;
      else if (typeof value === 'number') typeCounts.number++;
      else if (value instanceof Date) typeCounts.date++;
      else if (typeof value === 'boolean') typeCounts.boolean++;
    });
    
    // Determine dominant type
    let dominantType: DataType = 'string';
    let maxCount = typeCounts.string;
    let confidence = 0;
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        dominantType = type as DataType;
        maxCount = count;
      }
    });
    
    // Calculate confidence
    confidence = columnData.length > 0 ? maxCount / columnData.length : 0;
    
    // Handle mixed types
    if (confidence < 0.8 && columnData.length > 5) {
      dominantType = 'mixed';
      confidence = 0.5;
    }
    
    return {
      name: header,
      type: dominantType,
      confidence,
      samples,
      nullCount: rows.length - columnData.length,
      uniqueCount: new Set(columnData).size,
    };
  });
};

// Main file processing function
export const processFile = async (
  uploadedFile: UploadedFile, 
  options: FileParseOptions = {}
): Promise<ProcessedFile> => {
  try {
    let parsedData: ParsedData;
    
    if (uploadedFile.name.toLowerCase().endsWith('.csv')) {
      parsedData = await parseCSVFile(uploadedFile.content, options);
    } else if (uploadedFile.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      parsedData = await parseExcelFile(uploadedFile.content, options);
    } else {
      throw new Error('Unsupported file format');
    }
    
    return {
      ...uploadedFile,
      parsedData,
      encoding: options.encoding || 'utf-8',
      delimiter: options.delimiter,
      hasHeader: options.hasHeader ?? true,
      status: 'ready',
    };
  } catch (error) {
    return {
      ...uploadedFile,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    } as ProcessedFile;
  }
};

// Auto-detect delimiter for CSV files
export const detectDelimiter = (sample: string): string => {
  const delimiters = [',', ';', '\t', '|'];
  let maxCount = 0;
  let detectedDelimiter = ',';
  
  delimiters.forEach(delimiter => {
    const count = (sample.match(new RegExp(delimiter, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  });
  
  return detectedDelimiter;
};

// Auto-detect encoding
export const detectEncoding = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // Simple encoding detection - in production, you might want to use a more sophisticated library
      if (text.includes('�')) {
        resolve('windows-1252');
      } else {
        resolve('utf-8');
      }
    };
    reader.readAsText(file.slice(0, 1024)); // Read first 1KB for detection
  });
};