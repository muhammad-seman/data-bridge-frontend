'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ProcessedFile } from '@/types';

interface FileValidationProps {
  files: ProcessedFile[];
  onValidationComplete?: (results: ValidationSummary) => void;
}

interface ValidationSummary {
  totalFiles: number;
  validFiles: number;
  filesWithWarnings: number;
  filesWithErrors: number;
  canProceed: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  fileId: string;
  fileName: string;
  type: 'error' | 'warning' | 'info';
  category: 'structure' | 'data' | 'format' | 'size';
  message: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export function FileValidation({ files, onValidationComplete }: FileValidationProps) {
  const [validationResults, setValidationResults] = useState<ValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);

  // Validate individual file
  const validateFile = (file: ProcessedFile): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    
    if (!file.parsedData) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'error',
        category: 'structure',
        message: 'File could not be parsed',
        suggestion: 'Check if file format is supported (CSV, XLS, XLSX)'
      });
      return issues;
    }

    const { headers, rows, columnTypes } = file.parsedData;

    // Check file size
    if (file.size > 50 * 1024 * 1024) { // 50MB
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'warning',
        category: 'size',
        message: 'Large file size may impact performance',
        suggestion: 'Consider splitting into smaller files'
      });
    }

    // Check structure
    if (headers.length === 0) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'error',
        category: 'structure',
        message: 'No columns detected',
        suggestion: 'Ensure file has data and proper formatting'
      });
    }

    if (rows.length === 0) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'error',
        category: 'structure',
        message: 'No data rows found',
        suggestion: 'File appears to be empty or contains only headers'
      });
    }

    // Check for duplicate column names
    const duplicateColumns = headers.filter((header, index) => 
      headers.indexOf(header) !== index
    );
    
    if (duplicateColumns.length > 0) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'warning',
        category: 'structure',
        message: `Duplicate column names found: ${duplicateColumns.join(', ')}`,
        suggestion: 'Consider renaming duplicate columns for better mapping',
        autoFixable: true
      });
    }

    // Check for empty column names
    const emptyColumns = headers.filter((header) => 
      !header || header.trim() === ''
    );
    
    if (emptyColumns.length > 0) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'warning',
        category: 'structure',
        message: `${emptyColumns.length} columns have no names`,
        suggestion: 'Columns will be auto-named (Column 1, Column 2, etc.)',
        autoFixable: true
      });
    }

    // Check data quality
    columnTypes.forEach((col) => {
      const nullPercentage = (col.nullCount / rows.length) * 100;
      
      if (nullPercentage > 50) {
        issues.push({
          fileId: file.id,
          fileName: file.name,
          type: 'warning',
          category: 'data',
          message: `Column "${col.name}" is ${Math.round(nullPercentage)}% empty`,
          suggestion: 'Consider if this column is needed for analysis'
        });
      }

      if (col.confidence < 0.6) {
        issues.push({
          fileId: file.id,
          fileName: file.name,
          type: 'info',
          category: 'data',
          message: `Column "${col.name}" has mixed data types`,
          suggestion: 'Data type detection confidence is low - may need manual review'
        });
      }
    });

    // Check for very wide tables
    if (headers.length > 50) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'info',
        category: 'structure',
        message: `File has ${headers.length} columns`,
        suggestion: 'Consider if all columns are needed for analysis'
      });
    }

    // Check for very long tables
    if (rows.length > 100000) {
      issues.push({
        fileId: file.id,
        fileName: file.name,
        type: 'info',
        category: 'size',
        message: `File has ${rows.length.toLocaleString()} rows`,
        suggestion: 'Large datasets may take longer to process'
      });
    }

    return issues;
  };

  // Run validation
  const runValidation = async () => {
    setIsValidating(true);
    setValidationProgress(0);
    
    const allIssues: ValidationIssue[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileIssues = validateFile(file);
      allIssues.push(...fileIssues);
      
      // Update progress
      setValidationProgress(((i + 1) / files.length) * 100);
      
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const errorFiles = new Set(allIssues.filter(i => i.type === 'error').map(i => i.fileId));
    const warningFiles = new Set(allIssues.filter(i => i.type === 'warning').map(i => i.fileId));
    
    const summary: ValidationSummary = {
      totalFiles: files.length,
      validFiles: files.length - errorFiles.size,
      filesWithWarnings: warningFiles.size,
      filesWithErrors: errorFiles.size,
      canProceed: errorFiles.size === 0,
      issues: allIssues
    };
    
    setValidationResults(summary);
    setIsValidating(false);
    onValidationComplete?.(summary);
  };

  // Auto-run validation when files change
  useEffect(() => {
    if (files.length > 0) {
      runValidation();
    } else {
      setValidationResults(null);
    }
  }, [files, runValidation]);

  const getIssueIcon = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getIssueBadgeColor = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-orange-100 text-orange-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const groupedIssues = validationResults?.issues.reduce((acc, issue) => {
    if (!acc[issue.fileName]) {
      acc[issue.fileName] = [];
    }
    acc[issue.fileName].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>) || {};

  if (files.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">File Validation</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runValidation}
            disabled={isValidating}
          >
            Re-validate
          </Button>
        </div>

        {/* Validation Progress */}
        {isValidating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Validating files...</span>
              <span className="text-gray-500">{Math.round(validationProgress)}%</span>
            </div>
            <Progress value={validationProgress} />
          </div>
        )}

        {/* Validation Summary */}
        {validationResults && !isValidating && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {validationResults.totalFiles}
                </div>
                <div className="text-sm text-gray-600">Total Files</div>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <div className="text-lg font-semibold text-green-900">
                  {validationResults.validFiles}
                </div>
                <div className="text-sm text-green-600">Valid Files</div>
              </div>
              
              {validationResults.filesWithWarnings > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-orange-900">
                    {validationResults.filesWithWarnings}
                  </div>
                  <div className="text-sm text-orange-600">With Warnings</div>
                </div>
              )}
              
              {validationResults.filesWithErrors > 0 && (
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-red-900">
                    {validationResults.filesWithErrors}
                  </div>
                  <div className="text-sm text-red-600">With Errors</div>
                </div>
              )}
            </div>

            {/* Overall Status */}
            <div className={`
              p-4 rounded-lg border-l-4 
              ${validationResults.canProceed 
                ? 'bg-green-50 border-green-400' 
                : 'bg-red-50 border-red-400'
              }
            `}>
              <div className="flex items-center">
                {validationResults.canProceed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                )}
                <div>
                  <p className={`font-medium ${
                    validationResults.canProceed ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {validationResults.canProceed 
                      ? 'All files are ready to proceed' 
                      : 'Some files have errors that need attention'
                    }
                  </p>
                  {!validationResults.canProceed && (
                    <p className="text-sm text-red-600 mt-1">
                      Please fix the errors before proceeding to the next step
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Issues by File */}
            {Object.keys(groupedIssues).length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Issues Found</h4>
                
                {Object.entries(groupedIssues).map(([fileName, issues]) => (
                  <Card key={fileName} className="p-3">
                    <h5 className="font-medium text-gray-900 mb-2">{fileName}</h5>
                    
                    <div className="space-y-2">
                      {issues.map((issue, index) => (
                        <div key={index} className="flex items-start space-x-3 p-2 bg-gray-50 rounded">
                          <div className="flex-shrink-0 mt-0.5">
                            {getIssueIcon(issue.type)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getIssueBadgeColor(issue.type)}`}
                              >
                                {issue.type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {issue.category}
                              </Badge>
                              {issue.autoFixable && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  Auto-fixable
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-900">{issue.message}</p>
                            
                            {issue.suggestion && (
                              <p className="text-xs text-gray-600 mt-1">
                                💡 {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}