/**
 * Type guards for runtime type checking
 */

/**
 * Checks if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if a value is a valid number (not NaN or Infinity)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Checks if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return isValidNumber(value) && value > 0;
}

/**
 * Checks if a value is a valid array with optional type checking
 */
export function isArray<T = unknown>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is T[] {
  if (!Array.isArray(value)) {
    return false;
  }
  
  if (itemGuard) {
    return value.every(item => itemGuard(item));
  }
  
  return true;
}

/**
 * Checks if a value is a valid file path structure
 */
export interface FilePath {
  path: string;
  isAbsolute: boolean;
}

export function isFilePath(value: unknown): value is FilePath {
  return (
    isObject(value) &&
    isNonEmptyString(value.path) &&
    typeof value.isAbsolute === 'boolean'
  );
}

/**
 * Checks if a value is a valid URL string
 */
export function isUrlString(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }
  
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a value is a valid model info structure
 */
export interface ModelInfo {
  name: string;
  vendor?: string;
  version?: string;
  parameters?: Record<string, unknown>;
}

export function isModelInfo(value: unknown): value is ModelInfo {
  return (
    isObject(value) &&
    isNonEmptyString(value.name) &&
    (value.vendor === undefined || isNonEmptyString(value.vendor)) &&
    (value.version === undefined || isNonEmptyString(value.version)) &&
    (value.parameters === undefined || isObject(value.parameters))
  );
}

/**
 * Checks if a value is a valid message structure
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isObject(value) &&
    ['user', 'assistant', 'system'].includes(value.role as string) &&
    isNonEmptyString(value.content) &&
    (value.timestamp === undefined || isValidNumber(value.timestamp)) &&
    (value.metadata === undefined || isObject(value.metadata))
  );
}

/**
 * Checks if a value is a valid configuration value
 */
export interface ConfigValue {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export function isConfigValue(value: unknown): value is ConfigValue {
  if (!isObject(value) || !isNonEmptyString(value.key)) {
    return false;
  }
  
  const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
  if (!validTypes.includes(value.type as string)) {
    return false;
  }
  
  // Type-specific validation
  switch (value.type) {
    case 'string':
      return typeof value.value === 'string';
    case 'number':
      return isValidNumber(value.value);
    case 'boolean':
      return typeof value.value === 'boolean';
    case 'object':
      return isObject(value.value);
    case 'array':
      return Array.isArray(value.value);
    default:
      return false;
  }
}

/**
 * Checks if a value is a valid error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isObject(value) &&
    isNonEmptyString(value.error) &&
    (value.code === undefined || isNonEmptyString(value.code))
  );
}

/**
 * Creates a type guard for enum values
 */
export function createEnumGuard<T extends string | number>(
  enumObj: Record<string, T>
): (value: unknown) => value is T {
  const values = Object.values(enumObj);
  return (value: unknown): value is T => values.includes(value as T);
}

/**
 * Creates a type guard for objects with specific shape
 */
export function createObjectGuard<T extends Record<string, unknown>>(
  shape: { [K in keyof T]: (value: unknown) => value is T[K] }
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (!isObject(value)) {
      return false;
    }
    
    for (const [key, guard] of Object.entries(shape)) {
      if (!guard(value[key])) {
        return false;
      }
    }
    
    return true;
  };
}

/**
 * Checks if a value matches a specific pattern
 */
export function matchesPattern(pattern: RegExp): (value: unknown) => value is string {
  return (value: unknown): value is string => {
    return isNonEmptyString(value) && pattern.test(value);
  };
}

/**
 * Checks if a value is within a numeric range
 */
export function isInRange(min: number, max: number): (value: unknown) => value is number {
  return (value: unknown): value is number => {
    return isValidNumber(value) && value >= min && value <= max;
  };
}

/**
 * Checks if a value is one of the allowed values
 */
export function isOneOf<T>(allowedValues: readonly T[]): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return allowedValues.includes(value as T);
  };
}

/**
 * Combines multiple type guards with AND logic
 */
export function combineGuards<T>(
  ...guards: Array<(value: unknown) => value is T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return guards.every(guard => guard(value));
  };
}

/**
 * Combines multiple type guards with OR logic
 */
export function anyGuard<T>(
  ...guards: Array<(value: unknown) => value is T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return guards.some(guard => guard(value));
  };
}

/**
 * Optional type guard - allows undefined
 */
export function optional<T>(
  guard: (value: unknown) => value is T
): (value: unknown) => value is T | undefined {
  return (value: unknown): value is T | undefined => {
    return value === undefined || guard(value);
  };
}

/**
 * Nullable type guard - allows null
 */
export function nullable<T>(
  guard: (value: unknown) => value is T
): (value: unknown) => value is T | null {
  return (value: unknown): value is T | null => {
    return value === null || guard(value);
  };
}