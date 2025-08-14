'use client';

import { useState } from 'react';
import { ArrowRight, Upload, Eye, CheckCircle, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { FileDropzone } from './dropzone/file-dropzone';
import { FilePreview } from './preview/file-preview';
import { FileValidation } from './validation/file-validation';
import { useAppStore } from '@/store';
import type { UploadedFile } from '@/types';

interface UploadWizardProps {
  onComplete?: () => void;
  maxFiles?: number;
}

type WizardStep = 'upload' | 'preview' | 'validate' | 'configure';

interface StepInfo {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed?: boolean;
}

export function UploadWizard({ onComplete, maxFiles = 5 }: UploadWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [validationPassed, setValidationPassed] = useState(false);
  
  const { files, setCurrentStep: setGlobalStep } = useAppStore();

  const steps: StepInfo[] = [
    {
      id: 'upload',
      title: 'Upload Files',
      description: 'Add your CSV and Excel files',
      icon: <Upload className="w-5 h-5" />,
      completed: files.length > 0
    },
    {
      id: 'preview',
      title: 'Preview Data',
      description: 'Review your uploaded files',
      icon: <Eye className="w-5 h-5" />,
      completed: files.some(f => f.status === 'ready') && selectedFiles.length > 0
    },
    {
      id: 'validate',
      title: 'Validate Quality',
      description: 'Check for data issues',
      icon: <CheckCircle className="w-5 h-5" />,
      completed: validationPassed
    },
    {
      id: 'configure',
      title: 'Configure',
      description: 'Adjust processing settings',
      icon: <Settings className="w-5 h-5" />,
      completed: false
    }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  const handleFilesProcessed = (uploadedFiles: UploadedFile[]) => {
    // Auto-advance to preview when files are uploaded
    if (uploadedFiles.length > 0) {
      setTimeout(() => setCurrentStep('preview'), 1000);
    }
  };

  const handleFileSelect = (fileId: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  const handleValidationComplete = (results: { canProceed: boolean }) => {
    setValidationPassed(results.canProceed);
  };

  const handleStepClick = (stepId: WizardStep) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    // Allow going back or to completed steps
    if (stepIndex <= currentIndex || steps[stepIndex].completed) {
      setCurrentStep(stepId);
    }
  };

  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setCurrentStep(nextStep.id);
    } else {
      // Complete the wizard
      setGlobalStep('mapping');
      onComplete?.();
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
      case 'upload':
        return files.length > 0 && files.some(f => f.status === 'ready');
      case 'preview':
        return selectedFiles.length > 0;
      case 'validate':
        return validationPassed;
      case 'configure':
        return true;
      default:
        return false;
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Upload Your Data Files
              </h2>
              <p className="text-gray-600">
                Start by uploading CSV or Excel files containing your data.
                We'll automatically parse and preview them for you.
              </p>
            </div>
            
            <FileDropzone 
              maxFiles={maxFiles}
              onFilesProcessed={handleFilesProcessed}
            />
          </div>
        );
        
      case 'preview':
        const readyFiles = files.filter(f => f.status === 'ready');
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Preview Your Data
              </h2>
              <p className="text-gray-600">
                Review your uploaded files and select the ones you want to work with.
                {selectedFiles.length > 0 && ` ${selectedFiles.length} file(s) selected.`}
              </p>
            </div>
            
            <div className="space-y-4">
              {readyFiles.map(file => (
                <FilePreview
                  key={file.id}
                  file={file}
                  onSelect={handleFileSelect}
                  isSelected={selectedFiles.includes(file.id)}
                />
              ))}
            </div>
            
            {readyFiles.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-gray-500">
                  No files ready for preview yet. Please wait for files to finish processing.
                </p>
              </Card>
            )}
          </div>
        );
        
      case 'validate':
        const selectedFileObjects = files.filter(f => selectedFiles.includes(f.id));
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Data Quality Check
              </h2>
              <p className="text-gray-600">
                We&apos;re analyzing your selected files for potential issues and data quality problems.
              </p>
            </div>
            
            <FileValidation 
              files={selectedFileObjects}
              onValidationComplete={handleValidationComplete}
            />
          </div>
        );
        
      case 'configure':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Configure Processing
              </h2>
              <p className="text-gray-600">
                Fine-tune how your data should be processed (optional).
              </p>
            </div>
            
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <Settings className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                  <h3 className="font-medium text-blue-900">Configuration Options</h3>
                  <p className="text-sm text-blue-700">
                    Advanced settings will be available in the next version.
                    For now, we&apos;ll use smart defaults based on your data.
                  </p>
                </div>
                
                <div className="text-left space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Auto-detect data types</span>
                    <Badge variant="secondary">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Header row detection</span>
                    <Badge variant="secondary">Enabled</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Data cleaning</span>
                    <Badge variant="secondary">Basic</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Progress Header */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Data Upload</h1>
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
            const isCompleted = step.completed;
            const isAccessible = index <= currentStepIndex || isCompleted;
            
            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(step.id)}
                disabled={!isAccessible}
                className={`
                  p-3 rounded-lg text-left transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-100 border-2 border-blue-500 text-blue-900' 
                    : isCompleted
                      ? 'bg-green-50 border border-green-200 text-green-900 hover:bg-green-100'
                      : isAccessible
                        ? 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                        : 'bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed'
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-96">
        {getStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
        >
          Previous
        </Button>
        
        <div className="flex items-center space-x-4">
          {currentStep === 'upload' && files.length > 0 && (
            <p className="text-sm text-gray-600">
              {files.filter(f => f.status === 'ready').length} of {files.length} files ready
            </p>
          )}
          
          {currentStep === 'preview' && (
            <p className="text-sm text-gray-600">
              {selectedFiles.length} file(s) selected
            </p>
          )}
        </div>

        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="min-w-32"
        >
          {currentStepIndex === steps.length - 1 ? 'Complete' : 'Next'}
          {currentStepIndex < steps.length - 1 && (
            <ArrowRight className="w-4 h-4 ml-2" />
          )}
        </Button>
      </div>
    </div>
  );
}