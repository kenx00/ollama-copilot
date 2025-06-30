/**
 * Validation interfaces
 */

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: any;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  value?: any;
  warnings?: ValidationError[];
}