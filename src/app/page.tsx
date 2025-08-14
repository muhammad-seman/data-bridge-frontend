'use client';

import { UploadWizard } from '@/components/upload/upload-wizard';
import { MappingWizard } from '@/components/mapping/mapping-wizard';
import { useAppStore } from '@/store';

export default function Home() {
  const { currentStep } = useAppStore();

  const handleUploadComplete = () => {
    console.log('Upload wizard completed!');
  };

  const handleMappingComplete = () => {
    console.log('Mapping wizard completed!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7l8-4 8 4M4 7l8 4 8-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Data Bridge</h1>
                <p className="text-sm text-gray-600">Transform data silos into unified insights</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                <span>Current Step:</span>
                <span className="font-medium capitalize">{currentStep}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        {currentStep === 'upload' && (
          <UploadWizard onComplete={handleUploadComplete} />
        )}
        
        {currentStep === 'mapping' && (
          <MappingWizard onComplete={handleMappingComplete} />
        )}
        
        {(currentStep === 'visualization' || currentStep === 'export') && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {currentStep === 'visualization' && 'Data Visualization'}
                {currentStep === 'export' && 'Export & Reports'}
              </h2>
              <p className="text-gray-600 mb-8">
                {currentStep === 'visualization' && 'Create charts and dashboards from your integrated data'}
                {currentStep === 'export' && 'Generate reports and export your insights'}
              </p>
              
              <div className="p-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center space-y-4">
                  <div className="p-4 bg-blue-50 rounded-full w-16 h-16 mx-auto">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentStep.charAt(0).toUpperCase() + currentStep.slice(1)} Module
                  </h3>
                  <p className="text-gray-600">
                    This section is under development. 
                    <br />
                    Coming soon in the next development phase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Data Bridge - Bridging data silos for unified business insights
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Built with Next.js, TypeScript, and Tailwind CSS
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
