import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  AppState,
  ProcessedFile,
  ColumnMapping,
  ProcessedDataset,
  ChartConfig,
  InsightSuggestion,
  ExportJob
} from '@/types';

interface AppStore extends AppState {
  // File management actions
  addFiles: (files: ProcessedFile[]) => void;
  removeFile: (fileId: string) => void;
  updateFile: (fileId: string, updates: Partial<ProcessedFile>) => void;
  selectFiles: (fileIds: string[]) => void;
  
  // Mapping actions
  addMapping: (mapping: ColumnMapping) => void;
  updateMapping: (mappingId: string, updates: Partial<ColumnMapping>) => void;
  removeMapping: (mappingId: string) => void;
  
  // Dataset actions
  addDataset: (dataset: ProcessedDataset) => void;
  updateDataset: (datasetId: string, updates: Partial<ProcessedDataset>) => void;
  removeDataset: (datasetId: string) => void;
  selectDataset: (datasetId: string) => void;
  
  // Visualization actions
  addChart: (chart: ChartConfig) => void;
  updateChart: (chartId: string, updates: Partial<ChartConfig>) => void;
  removeChart: (chartId: string) => void;
  
  // Insights actions
  addInsight: (insight: InsightSuggestion) => void;
  removeInsight: (insightId: string) => void;
  
  // Export actions
  addExportJob: (job: ExportJob) => void;
  updateExportJob: (jobId: string, updates: Partial<ExportJob>) => void;
  removeExportJob: (jobId: string) => void;
  
  // Navigation actions
  setCurrentStep: (step: AppState['currentStep']) => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // UI state actions
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Utility actions
  reset: () => void;
  clearCache: () => void;
}

const initialState: AppState = {
  files: [],
  mappings: [],
  datasets: [],
  charts: [],
  insights: [],
  exportJobs: [],
  currentStep: 'upload',
  selectedFiles: [],
  selectedDataset: undefined,
  isProcessing: false,
  error: undefined,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // File management
        addFiles: (files) =>
          set((state) => ({
            files: [...state.files, ...files],
          }), false, 'addFiles'),

        removeFile: (fileId) =>
          set((state) => ({
            files: state.files.filter((file) => file.id !== fileId),
            selectedFiles: state.selectedFiles.filter((id) => id !== fileId),
          }), false, 'removeFile'),

        updateFile: (fileId, updates) =>
          set((state) => ({
            files: state.files.map((file) =>
              file.id === fileId ? { ...file, ...updates } : file
            ),
          }), false, 'updateFile'),

        selectFiles: (fileIds) =>
          set({ selectedFiles: fileIds }, false, 'selectFiles'),

        // Mapping management
        addMapping: (mapping) =>
          set((state) => ({
            mappings: [...state.mappings, mapping],
          }), false, 'addMapping'),

        updateMapping: (mappingId, updates) =>
          set((state) => ({
            mappings: state.mappings.map((mapping) =>
              mapping.id === mappingId ? { ...mapping, ...updates } : mapping
            ),
          }), false, 'updateMapping'),

        removeMapping: (mappingId) =>
          set((state) => ({
            mappings: state.mappings.filter((mapping) => mapping.id !== mappingId),
          }), false, 'removeMapping'),

        // Dataset management
        addDataset: (dataset) =>
          set((state) => ({
            datasets: [...state.datasets, dataset],
          }), false, 'addDataset'),

        updateDataset: (datasetId, updates) =>
          set((state) => ({
            datasets: state.datasets.map((dataset) =>
              dataset.id === datasetId ? { ...dataset, ...updates } : dataset
            ),
          }), false, 'updateDataset'),

        removeDataset: (datasetId) =>
          set((state) => ({
            datasets: state.datasets.filter((dataset) => dataset.id !== datasetId),
            selectedDataset: state.selectedDataset === datasetId ? undefined : state.selectedDataset,
          }), false, 'removeDataset'),

        selectDataset: (datasetId) =>
          set({ selectedDataset: datasetId }, false, 'selectDataset'),

        // Visualization management
        addChart: (chart) =>
          set((state) => ({
            charts: [...state.charts, chart],
          }), false, 'addChart'),

        updateChart: (chartId, updates) =>
          set((state) => ({
            charts: state.charts.map((chart) =>
              chart.id === chartId ? { ...chart, ...updates } : chart
            ),
          }), false, 'updateChart'),

        removeChart: (chartId) =>
          set((state) => ({
            charts: state.charts.filter((chart) => chart.id !== chartId),
          }), false, 'removeChart'),

        // Insights management
        addInsight: (insight) =>
          set((state) => ({
            insights: [...state.insights, insight],
          }), false, 'addInsight'),

        removeInsight: (insightId) =>
          set((state) => ({
            insights: state.insights.filter((insight) => insight.id !== insightId),
          }), false, 'removeInsight'),

        // Export management
        addExportJob: (job) =>
          set((state) => ({
            exportJobs: [...state.exportJobs, job],
          }), false, 'addExportJob'),

        updateExportJob: (jobId, updates) =>
          set((state) => ({
            exportJobs: state.exportJobs.map((job) =>
              job.id === jobId ? { ...job, ...updates } : job
            ),
          }), false, 'updateExportJob'),

        removeExportJob: (jobId) =>
          set((state) => ({
            exportJobs: state.exportJobs.filter((job) => job.id !== jobId),
          }), false, 'removeExportJob'),

        // Navigation
        setCurrentStep: (step) =>
          set({ currentStep: step }, false, 'setCurrentStep'),

        nextStep: () =>
          set((state) => {
            const steps: AppState['currentStep'][] = ['upload', 'mapping', 'visualization', 'export'];
            const currentIndex = steps.indexOf(state.currentStep);
            const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
            return { currentStep: steps[nextIndex] };
          }, false, 'nextStep'),

        previousStep: () =>
          set((state) => {
            const steps: AppState['currentStep'][] = ['upload', 'mapping', 'visualization', 'export'];
            const currentIndex = steps.indexOf(state.currentStep);
            const previousIndex = Math.max(currentIndex - 1, 0);
            return { currentStep: steps[previousIndex] };
          }, false, 'previousStep'),

        // UI state
        setProcessing: (processing) =>
          set({ isProcessing: processing }, false, 'setProcessing'),

        setError: (error) =>
          set({ error: error || undefined }, false, 'setError'),

        // Utility
        reset: () =>
          set(initialState, false, 'reset'),

        clearCache: () =>
          set((state) => ({
            exportJobs: state.exportJobs.filter((job) => job.status === 'processing'),
            error: undefined,
          }), false, 'clearCache'),
      }),
      {
        name: 'data-bridge-store',
        partialize: (state) => ({
          // Only persist essential data, not UI state
          files: state.files,
          mappings: state.mappings,
          datasets: state.datasets,
          charts: state.charts,
          currentStep: state.currentStep,
        }),
      }
    ),
    {
      name: 'data-bridge-store',
    }
  )
);

// Selectors for better performance
export const useFiles = () => useAppStore((state) => state.files);
export const useSelectedFiles = () => useAppStore((state) => state.selectedFiles);
export const useDatasets = () => useAppStore((state) => state.datasets);
export const useSelectedDataset = () => useAppStore((state) => state.selectedDataset);
export const useCharts = () => useAppStore((state) => state.charts);
export const useCurrentStep = () => useAppStore((state) => state.currentStep);
export const useIsProcessing = () => useAppStore((state) => state.isProcessing);
export const useError = () => useAppStore((state) => state.error);