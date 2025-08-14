'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Database, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ColumnMappingInterface } from './mapping-interface/column-mapping-interface';
import { DataMerger, type MergeOptions, type MergeResult } from '@/lib/data-merging';
import { useAppStore } from '@/store';
import type { ColumnMapping, ProcessedDataset } from '@/types';

interface MappingWizardProps {
  onComplete?: (dataset: ProcessedDataset) => void;
}

type MappingStep = 'configure' | 'preview' | 'merge' | 'complete';

interface StepInfo {
  id: MappingStep;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function MappingWizard({ onComplete }: MappingWizardProps) {
  const [currentStep, setCurrentStep] = useState<MappingStep>('configure');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const { files, addDataset, setCurrentStep: setGlobalStep } = useAppStore();

  // Get only ready files
  const readyFiles = files.filter(f => f.status === 'ready' && f.parsedData);

  const steps: StepInfo[] = [
    {
      id: 'configure',
      title: 'Configure Mappings',
      description: 'Map columns between your files',
      icon: <Database className="w-5 h-5" />
    },
    {
      id: 'preview',
      title: 'Preview Result',
      description: 'Review merged data structure',
      icon: <CheckCircle className="w-5 h-5" />
    },
    {
      id: 'merge',
      title: 'Merge Data',
      description: 'Combine files into unified dataset',
      icon: <ArrowRight className="w-5 h-5" />
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'Dataset ready for analysis',
      icon: <CheckCircle className="w-5 h-5" />
    }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  /**
   * Handle mapping completion from interface
   */
  const handleMappingComplete = (completedMappings: ColumnMapping[]) => {
    setMappings(completedMappings);
    setCurrentStep('preview');
  };

  /**
   * Generate preview of merged data structure
   */
  const generatePreview = () => {
    if (mappings.length === 0) return null;

    // Get all target columns from mappings
    const allTargetColumns = new Set<string>();
    mappings.forEach(mapping => {
      mapping.mappings.forEach(map => {
        allTargetColumns.add(map.targetColumn);
      });
    });

    // Calculate estimated stats
    const totalRows = readyFiles.reduce((sum, file) => 
      sum + (file.parsedData?.rowCount || 0), 0
    );

    const estimatedColumns = allTargetColumns.size;
    const filesCount = mappings.length;

    return {
      columns: estimatedColumns,
      estimatedRows: totalRows,
      sourceFiles: filesCount,
      targetColumns: Array.from(allTargetColumns).sort()
    };
  };

  /**
   * Perform actual data merge
   */
  const performMerge = async () => {
    if (mappings.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setCurrentStep('merge');

    try {
      // Simulate processing progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          const next = prev + Math.random() * 15;
          if (next >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return next;
        });
      }, 200);

      const mergeOptions: MergeOptions = {
        joinType: mappings[0]?.joinType || 'inner',
        joinKey: mappings[0]?.joinKey,
        handleDuplicates: 'keep_first',
        validateTypes: true,
        maxRows: 50000 // Limit for performance
      };

      const result = await DataMerger.mergeFiles(readyFiles, mappings, mergeOptions);
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
      setMergeResult(result);
      
      // Add dataset to store
      addDataset(result.dataset);
      
      // Short delay for UX
      setTimeout(() => {
        setCurrentStep('complete');
      }, 1000);

    } catch (error) {
      console.error('Merge failed:', error);
      setIsProcessing(false);
    }
  };

  /**
   * Complete the mapping process
   */
  const completeMappingWizard = () => {
    if (mergeResult) {
      onComplete?.(mergeResult.dataset);
      setGlobalStep('visualization');
    }
  };

  /**
   * Navigation handlers
   */
  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (currentStep === 'preview') {
      performMerge();
    } else if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep.id);
    } else {
      completeMappingWizard();
    }
  };

  const handlePrevious = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];
      setCurrentStep(prevStep.id);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'configure':
        return mappings.length > 0;
      case 'preview':
        return true;
      case 'merge':
        return mergeResult !== null;
      case 'complete':
        return true;
      default:
        return false;
    }
  };

  const preview = generatePreview();

  if (readyFiles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Files Ready for Mapping
          </h3>
          <p className="text-gray-600 mb-6">
            Please upload and process files in the previous step before proceeding with column mapping.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setGlobalStep('upload')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Column Mapping</h1>
            <Badge variant="outline" className="px-3 py-1">
              Step {currentStepIndex + 1} of {steps.length}
            </Badge>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        {/* Step Indicators */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const isAccessible = index <= currentStepIndex;
            
            return (
              <div
                key={step.id}
                className={`
                  p-3 rounded-lg text-left transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-100 border-2 border-blue-500 text-blue-900' 
                    : isCompleted
                      ? 'bg-green-50 border border-green-200 text-green-900'
                      : isAccessible
                        ? 'bg-gray-50 border border-gray-200 text-gray-600'
                        : 'bg-gray-50 border border-gray-200 text-gray-400'
                  }
                `}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                      {step.icon}
                    </div>
                  )}
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
                <p className="text-xs opacity-75">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-96">
        {currentStep === 'configure' && (
          <ColumnMappingInterface
            sourceFiles={readyFiles}
            onMappingComplete={handleMappingComplete}
          />
        )}

        {currentStep === 'preview' && preview && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Preview Merged Dataset
              </h2>
              <p className="text-gray-600">
                Review the structure of your merged dataset before processing
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 text-center">
                <div className="text-2xl font-bold text-blue-600">{preview.columns}</div>
                <div className="text-sm text-gray-600">Total Columns</div>
              </Card>
              
              <Card className="p-6 text-center">
                <div className="text-2xl font-bold text-green-600">{preview.estimatedRows.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Estimated Rows</div>
              </Card>
              
              <Card className="p-6 text-center">
                <div className="text-2xl font-bold text-purple-600">{preview.sourceFiles}</div>
                <div className="text-sm text-gray-600">Source Files</div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Target Schema</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {preview.targetColumns.map((column, index) => (
                  <Badge key={index} variant="outline" className="justify-center">
                    {column}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        )}

        {currentStep === 'merge' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Merging Data
              </h2>
              <p className="text-gray-600">
                Processing and combining your files into a unified dataset...
              </p>
            </div>

            <Card className="p-8">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Database className="w-8 h-8 text-blue-600" />
                </div>
                
                <div className="space-y-2">
                  <Progress value={processingProgress} className="h-3" />
                  <p className="text-sm text-gray-600">
                    {Math.round(processingProgress)}% complete
                  </p>
                </div>

                {mergeResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {mergeResult.stats.mergedRows.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600">Merged Rows</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {mergeResult.dataset.headers.length}
                        </div>
                        <div className="text-xs text-gray-600">Columns</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {mergeResult.stats.duplicateRows}
                        </div>
                        <div className="text-xs text-gray-600">Duplicates</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {mergeResult.warnings.length}
                        </div>
                        <div className="text-xs text-gray-600">Warnings</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {currentStep === 'complete' && mergeResult && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Mapping Complete!
              </h2>
              <p className="text-gray-600">
                Your unified dataset has been created successfully
              </p>
            </div>

            <Card className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {mergeResult.dataset.rowCount.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-700">Final Rows</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {mergeResult.dataset.headers.length}
                    </div>
                    <div className="text-sm text-blue-700">Final Columns</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {mergeResult.dataset.sourceFiles.length}
                    </div>
                    <div className="text-sm text-purple-700">Source Files</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(((mergeResult.stats.mergedRows - mergeResult.stats.nullValues) / (mergeResult.stats.mergedRows * mergeResult.dataset.headers.length)) * 100)}%
                    </div>
                    <div className="text-sm text-orange-700">Data Quality</div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Dataset: {mergeResult.dataset.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {mergeResult.dataset.headers.slice(0, 10).map((header, index) => (
                      <Badge key={index} variant="outline">{header}</Badge>
                    ))}
                    {mergeResult.dataset.headers.length > 10 && (
                      <Badge variant="outline">+{mergeResult.dataset.headers.length - 10} more</Badge>
                    )}
                  </div>
                </div>

                {mergeResult.warnings.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium text-orange-900 mb-3">Warnings</h4>
                    <div className="space-y-2">
                      {mergeResult.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-orange-700">{warning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStepIndex === 0 || isProcessing}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <div className="text-center">
          {currentStep === 'configure' && (
            <p className="text-sm text-gray-600">
              {mappings.length} mapping(s) configured
            </p>
          )}
          {currentStep === 'merge' && (
            <p className="text-sm text-gray-600">
              Processing {readyFiles.length} files...
            </p>
          )}
        </div>

        <Button
          onClick={handleNext}
          disabled={!canProceed() || isProcessing}
          className="min-w-32"
        >
          {currentStep === 'complete' ? 'Continue to Visualization' : 'Next'}
          {currentStep !== 'complete' && (
            <ArrowRight className="w-4 h-4 ml-2" />
          )}
        </Button>
      </div>
    </div>
  );
}