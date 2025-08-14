// Core Data Types for Data Bridge Application

// File handling types
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content: File;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error?: string;
}

// Data structure types
export interface ParsedData {
  headers: string[];
  rows: (string | number | Date | null)[][];
  rowCount: number;
  columnTypes: ColumnType[];
}

export interface ProcessedFile extends UploadedFile {
  parsedData: ParsedData;
  encoding?: string;
  delimiter?: string;
  hasHeader: boolean;
}

// Column and data type detection
export type DataType = 'string' | 'number' | 'date' | 'boolean' | 'mixed' | 'unknown';

export interface ColumnType {
  name: string;
  type: DataType;
  confidence: number; // 0-1 confidence score for auto-detection
  samples: (string | number | Date | null)[];
  nullCount: number;
  uniqueCount: number;
}

export interface ColumnSuggestion {
  sourceColumn: string;
  targetColumn: string;
  similarity: number; // 0-1 similarity score
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'none';
}

// Column mapping types
export interface ColumnMapping {
  id: string;
  sourceFileId: string;
  targetFileId?: string; // for joins
  mappings: {
    sourceColumn: string;
    targetColumn: string;
    transform?: 'none' | 'uppercase' | 'lowercase' | 'date_format' | 'number_format';
    transformParams?: Record<string, string | number | boolean>;
  }[];
  joinType?: 'inner' | 'left' | 'right' | 'full';
  joinKey?: string;
}

// Processed dataset types
export interface ProcessedDataset {
  id: string;
  name: string;
  sourceFiles: string[]; // file IDs
  headers: string[];
  data: Record<string, string | number | Date | boolean | null>[];
  columnTypes: ColumnType[];
  createdAt: Date;
  rowCount: number;
}

// Visualization types
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'table';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  datasetId: string;
  xAxis: string;
  yAxis: string | string[]; // can be array for multiple series
  filters?: Filter[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupBy?: string;
  color?: string;
  width?: number;
  height?: number;
}

export interface Filter {
  column: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'starts_with';
  value: string | number | Date;
}

export interface InsightSuggestion {
  id: string;
  type: 'correlation' | 'trend' | 'outlier' | 'summary';
  title: string;
  description: string;
  confidence: number;
  chartConfig?: ChartConfig;
  datasetId: string;
}

// Export types
export interface ExportConfig {
  format: 'pdf' | 'png' | 'jpg' | 'csv' | 'excel';
  includeCharts: boolean;
  includeData: boolean;
  includeSummary: boolean;
  title?: string;
  description?: string;
  fileName?: string;
}

export interface ExportJob {
  id: string;
  config: ExportConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// UI State types
export interface AppState {
  // File management
  files: ProcessedFile[];
  
  // Data processing
  mappings: ColumnMapping[];
  datasets: ProcessedDataset[];
  
  // Visualization
  charts: ChartConfig[];
  insights: InsightSuggestion[];
  
  // Export
  exportJobs: ExportJob[];
  
  // UI state
  currentStep: 'upload' | 'mapping' | 'visualization' | 'export';
  selectedFiles: string[];
  selectedDataset?: string;
  isProcessing: boolean;
  error?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Utility types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  skipRows?: number;
  maxRows?: number;
}

// Error handling types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, string | number | boolean>;
  timestamp: Date;
}

// Configuration types
export interface AppConfig {
  maxFileSize: number; // in bytes
  supportedFormats: string[];
  maxFilesPerUpload: number;
  processingTimeout: number; // in ms
  autoSaveInterval: number; // in ms
}