/**
 * Text processing utilities for column matching and data analysis
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity percentage between two strings
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

/**
 * Normalize text for better comparison
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract words from camelCase, snake_case, or kebab-case
 */
export function extractWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
    .replace(/[_-]/g, ' ') // snake_case, kebab-case
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Calculate Jaccard similarity for word sets
 */
export function jaccardSimilarity(words1: string[], words2: string[]): number {
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate cosine similarity between two text strings
 */
export function cosineSimilarity(text1: string, text2: string): number {
  const words1 = extractWords(text1);
  const words2 = extractWords(text2);
  
  const allWords = [...new Set([...words1, ...words2])];
  
  const vector1 = allWords.map(word => words1.filter(w => w === word).length);
  const vector2 = allWords.map(word => words2.filter(w => w === word).length);
  
  const dotProduct = vector1.reduce((sum, a, i) => sum + a * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, a) => sum + a * a, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, a) => sum + a * a, 0));
  
  return magnitude1 * magnitude2 === 0 ? 0 : dotProduct / (magnitude1 * magnitude2);
}

/**
 * Find longest common subsequence length
 */
export function longestCommonSubsequence(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Check if text contains common business terms
 */
export function detectBusinessTerms(text: string): string[] {
  const businessTerms = {
    identifier: ['id', 'key', 'code', 'ref', 'number', 'num'],
    personal: ['name', 'firstname', 'lastname', 'fullname', 'title'],
    contact: ['email', 'phone', 'address', 'contact', 'mobile'],
    financial: ['price', 'cost', 'amount', 'value', 'total', 'sum', 'revenue'],
    temporal: ['date', 'time', 'created', 'updated', 'modified', 'timestamp'],
    status: ['status', 'state', 'active', 'enabled', 'flag', 'valid'],
    quantity: ['count', 'quantity', 'qty', 'size', 'length', 'weight'],
    category: ['type', 'category', 'group', 'class', 'kind', 'genre']
  };
  
  const normalizedText = normalizeText(text);
  const words = extractWords(normalizedText);
  const detectedTerms: string[] = [];
  
  for (const [category, terms] of Object.entries(businessTerms)) {
    if (terms.some(term => words.includes(term) || normalizedText.includes(term))) {
      detectedTerms.push(category);
    }
  }
  
  return detectedTerms;
}

/**
 * Generate alternative column names for better matching
 */
export function generateAlternatives(columnName: string): string[] {
  const alternatives: string[] = [columnName];
  const normalized = normalizeText(columnName);
  const words = extractWords(columnName);
  
  // Add normalized version
  if (normalized !== columnName.toLowerCase()) {
    alternatives.push(normalized);
  }
  
  // Add acronym
  if (words.length > 1) {
    const acronym = words.map(word => word[0]).join('');
    alternatives.push(acronym);
  }
  
  // Add variations without common prefixes/suffixes
  const withoutPrefixes = columnName.replace(/^(user|customer|client|item|product)_?/i, '');
  const withoutSuffixes = columnName.replace(/_?(id|key|code|num|number)$/i, '');
  
  if (withoutPrefixes !== columnName) alternatives.push(withoutPrefixes);
  if (withoutSuffixes !== columnName) alternatives.push(withoutSuffixes);
  
  // Add camelCase variations
  if (words.length > 1) {
    const camelCase = words[0] + words.slice(1).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    alternatives.push(camelCase);
    
    const pascalCase = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    alternatives.push(pascalCase);
  }
  
  return [...new Set(alternatives)]; // Remove duplicates
}