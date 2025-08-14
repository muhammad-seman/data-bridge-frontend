import Fuse from 'fuse.js';
import { levenshteinDistance } from './text-utils';
import type { 
  ProcessedFile, 
  ColumnSuggestion, 
  ColumnMapping, 
  DataType,
  ColumnType 
} from '@/types';

// Column mapping utilities and algorithms

/**
 * Smart column matching using multiple algorithms
 */
export class ColumnMatcher {
  private fuse: Fuse<{ name: string; index: number }>;
  
  constructor(targetColumns: string[]) {
    const fuseOptions = {
      keys: ['name'],
      threshold: 0.6, // Lower = more strict
      distance: 100,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    };
    
    const searchableColumns = targetColumns.map((name, index) => ({
      name: this.normalizeColumnName(name),
      index
    }));
    
    this.fuse = new Fuse(searchableColumns, fuseOptions);
  }

  /**
   * Normalize column names for better matching
   */
  private normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[_\-\s]+/g, ' ') // Replace separators with spaces
      .replace(/\b(id|no|num|number|code)\b/g, 'identifier') // Normalize identifier terms
      .replace(/\b(name|title|label)\b/g, 'name') // Normalize name terms
      .replace(/\b(date|time|timestamp)\b/g, 'date') // Normalize date terms
      .replace(/\b(amount|value|price|cost)\b/g, 'amount') // Normalize amount terms
      .replace(/\b(email|mail)\b/g, 'email') // Normalize email terms
      .replace(/\b(phone|tel|telephone)\b/g, 'phone') // Normalize phone terms
      .trim();
  }

  /**
   * Find best matches for a source column
   */
  findMatches(sourceColumn: string, limit: number = 5): ColumnSuggestion[] {
    const normalizedSource = this.normalizeColumnName(sourceColumn);
    const suggestions: ColumnSuggestion[] = [];

    // 1. Exact match (highest priority)
    const exactMatch = this.findExactMatch(normalizedSource);
    if (exactMatch) {
      suggestions.push(exactMatch);
    }

    // 2. Fuzzy search matches
    const fuzzyMatches = this.fuse.search(normalizedSource, { limit });
    
    for (const match of fuzzyMatches) {
      if (match.score !== undefined && match.score < 0.8) { // Good matches only
        const suggestion: ColumnSuggestion = {
          sourceColumn,
          targetColumn: match.item.name,
          similarity: 1 - match.score, // Convert to similarity score
          matchType: 'fuzzy'
        };
        
        // Avoid duplicates from exact match
        if (!suggestions.find(s => s.targetColumn === suggestion.targetColumn)) {
          suggestions.push(suggestion);
        }
      }
    }

    // 3. Semantic matching based on data types and patterns
    const semanticMatches = this.findSemanticMatches(sourceColumn, normalizedSource);
    for (const semantic of semanticMatches) {
      if (!suggestions.find(s => s.targetColumn === semantic.targetColumn)) {
        suggestions.push(semantic);
      }
    }

    // Sort by similarity score (descending)
    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find exact matches (case-insensitive)
   */
  private findExactMatch(normalizedSource: string): ColumnSuggestion | null {
    // Use fuzzy search with exact match threshold
    const exactMatches = this.fuse.search(normalizedSource, { limit: 1 });
    
    if (exactMatches.length > 0 && exactMatches[0].score === 0) {
      return {
        sourceColumn: normalizedSource,
        targetColumn: exactMatches[0].item.name,
        similarity: 1.0,
        matchType: 'exact'
      };
    }

    return null;
  }

  /**
   * Find semantic matches based on common patterns
   */
  private findSemanticMatches(originalColumn: string, normalizedSource: string): ColumnSuggestion[] {
    const suggestions: ColumnSuggestion[] = [];
    const commonPatterns = this.getCommonPatterns();

    for (const [pattern, variants] of Object.entries(commonPatterns)) {
      if (variants.some(variant => normalizedSource.includes(variant))) {
        // Find target columns that match this pattern using search
        const searchResults = this.fuse.search('', { limit: 1000 }); // Get all items
        const targetMatches = searchResults
          .map(result => result.item)
          .filter(item => variants.some(variant => item.name.includes(variant)));

        for (const target of targetMatches) {
          const similarity = this.calculateSemanticSimilarity(normalizedSource, target.name, pattern);
          if (similarity > 0.6) {
            suggestions.push({
              sourceColumn: originalColumn,
              targetColumn: target.name,
              similarity,
              matchType: 'semantic'
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Common semantic patterns for business data
   */
  private getCommonPatterns(): Record<string, string[]> {
    return {
      identifier: ['id', 'identifier', 'key', 'code', 'num', 'ref'],
      name: ['name', 'title', 'label', 'description'],
      date: ['date', 'time', 'created', 'updated', 'modified'],
      amount: ['amount', 'value', 'price', 'cost', 'total', 'sum'],
      contact: ['email', 'phone', 'address', 'contact'],
      status: ['status', 'state', 'flag', 'active', 'enabled'],
      count: ['count', 'quantity', 'qty', 'number', 'total'],
      category: ['category', 'type', 'group', 'class', 'kind']
    };
  }

  /**
   * Calculate semantic similarity based on pattern matching
   */
  private calculateSemanticSimilarity(source: string, target: string, pattern: string): number {
    // Base similarity from Levenshtein distance
    const baseSimilarity = 1 - (levenshteinDistance(source, target) / Math.max(source.length, target.length));
    
    // Boost for semantic pattern match
    const patternBoost = 0.3;
    
    // Additional boost for word order similarity
    const sourceWords = source.split(' ');
    const targetWords = target.split(' ');
    const wordOrderSimilarity = this.calculateWordOrderSimilarity(sourceWords, targetWords);
    
    return Math.min(baseSimilarity + patternBoost + (wordOrderSimilarity * 0.2), 1.0);
  }

  /**
   * Calculate word order similarity
   */
  private calculateWordOrderSimilarity(sourceWords: string[], targetWords: string[]): number {
    const intersection = sourceWords.filter(word => targetWords.includes(word));
    const union = [...new Set([...sourceWords, ...targetWords])];
    return intersection.length / union.length;
  }
}

/**
 * Data type compatibility checker
 */
export class DataTypeDetector {
  /**
   * Check if two data types are compatible for mapping
   */
  static areTypesCompatible(sourceType: DataType, targetType: DataType): boolean {
    // Same types are always compatible
    if (sourceType === targetType) return true;

    // Compatible type combinations
    const compatibleTypes: Record<DataType, DataType[]> = {
      string: ['mixed', 'unknown'],
      number: ['string', 'mixed', 'unknown'], // Numbers can be converted to string
      date: ['string', 'mixed', 'unknown'], // Dates can be formatted as strings
      boolean: ['string', 'number', 'mixed', 'unknown'], // Booleans can be converted
      mixed: ['string', 'number', 'date', 'boolean', 'unknown'], // Mixed accepts most types
      unknown: ['string', 'number', 'date', 'boolean', 'mixed'] // Unknown accepts all
    };

    return compatibleTypes[sourceType]?.includes(targetType) || false;
  }

  /**
   * Get confidence score for type conversion
   */
  static getConversionConfidence(sourceType: DataType, targetType: DataType): number {
    if (sourceType === targetType) return 1.0;

    const conversionScores: Record<string, number> = {
      'string-mixed': 0.9,
      'number-string': 0.95,
      'date-string': 0.9,
      'boolean-string': 0.95,
      'boolean-number': 0.8,
      'mixed-string': 0.7,
      'unknown-string': 0.5,
    };

    const key = `${sourceType}-${targetType}`;
    return conversionScores[key] || 0.3;
  }

  /**
   * Suggest data transformations needed
   */
  static suggestTransformation(sourceType: DataType, targetType: DataType): string | null {
    if (sourceType === targetType) return null;

    const transformations: Record<string, string> = {
      'number-string': 'Convert numbers to text format',
      'date-string': 'Format dates as text (YYYY-MM-DD)',
      'boolean-string': 'Convert true/false to text',
      'boolean-number': 'Convert true=1, false=0',
      'string-number': 'Parse numeric values from text',
      'string-date': 'Parse dates from text format',
      'mixed-string': 'Convert all values to text format',
    };

    const key = `${sourceType}-${targetType}`;
    return transformations[key] || `Convert ${sourceType} to ${targetType}`;
  }
}

/**
 * Column mapping generator
 */
export class MappingGenerator {
  /**
   * Generate automatic column mappings between files
   */
  static generateAutoMappings(
    sourceFile: ProcessedFile,
    targetFile: ProcessedFile,
    confidenceThreshold: number = 0.7
  ): ColumnMapping {
    if (!sourceFile.parsedData || !targetFile.parsedData) {
      throw new Error('Both files must have parsed data');
    }

    const sourceColumns = sourceFile.parsedData.headers;
    const targetColumns = targetFile.parsedData.headers;
    
    const matcher = new ColumnMatcher(targetColumns);
    const mappings: ColumnMapping['mappings'] = [];

    for (const sourceColumn of sourceColumns) {
      const suggestions = matcher.findMatches(sourceColumn, 1);
      
      if (suggestions.length > 0 && suggestions[0].similarity >= confidenceThreshold) {
        const bestMatch = suggestions[0];
        
        // Check data type compatibility
        const sourceColType = sourceFile.parsedData.columnTypes.find(c => c.name === sourceColumn);
        const targetColType = targetFile.parsedData.columnTypes.find(c => c.name === bestMatch.targetColumn);
        
        if (sourceColType && targetColType) {
          const isCompatible = DataTypeDetector.areTypesCompatible(sourceColType.type, targetColType.type);
          
          if (isCompatible) {
            mappings.push({
              sourceColumn,
              targetColumn: bestMatch.targetColumn,
              transform: MappingGenerator.getRecommendedTransform(sourceColType.type, targetColType.type)
            });
          }
        }
      }
    }

    return {
      id: `mapping-${sourceFile.id}-${targetFile.id}-${Date.now()}`,
      sourceFileId: sourceFile.id,
      targetFileId: targetFile.id,
      mappings,
      joinType: 'inner' // Default join type
    };
  }

  /**
   * Get recommended transformation based on data types
   */
  private static getRecommendedTransform(
    sourceType: DataType, 
    targetType: DataType
  ): ColumnMapping['mappings'][0]['transform'] {
    if (sourceType === targetType) return 'none';
    
    if (sourceType === 'string' && targetType === 'string') {
      return 'none'; // No transformation needed
    }
    
    if (sourceType === 'date' && targetType === 'string') {
      return 'date_format';
    }
    
    if (sourceType === 'number' && targetType === 'string') {
      return 'number_format';
    }
    
    return 'none';
  }

  /**
   * Validate mapping configuration
   */
  static validateMapping(mapping: ColumnMapping, sourceFile: ProcessedFile, targetFile?: ProcessedFile): string[] {
    const errors: string[] = [];

    if (!sourceFile.parsedData) {
      errors.push('Source file has no parsed data');
      return errors;
    }

    const sourceColumns = sourceFile.parsedData.headers;

    // Check if all mapped source columns exist
    for (const map of mapping.mappings) {
      if (!sourceColumns.includes(map.sourceColumn)) {
        errors.push(`Source column "${map.sourceColumn}" does not exist in file`);
      }
    }

    // If target file is provided, validate target columns
    if (targetFile?.parsedData) {
      const targetColumns = targetFile.parsedData.headers;
      
      for (const map of mapping.mappings) {
        if (!targetColumns.includes(map.targetColumn)) {
          errors.push(`Target column "${map.targetColumn}" does not exist in target file`);
        }
      }
    }

    // Check for duplicate mappings
    const targetColumnCounts = new Map<string, number>();
    for (const map of mapping.mappings) {
      const count = targetColumnCounts.get(map.targetColumn) || 0;
      targetColumnCounts.set(map.targetColumn, count + 1);
    }

    for (const [column, count] of targetColumnCounts.entries()) {
      if (count > 1) {
        errors.push(`Target column "${column}" is mapped multiple times`);
      }
    }

    return errors;
  }
}