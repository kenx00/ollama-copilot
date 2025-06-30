/**
 * @file Runtime type guard functions
 * @module types/guards
 * @description Type guard functions for runtime type checking and validation
 */

import { JsonValue, JsonObject, JsonArray, TypeGuard, SessionId, FilePath, ModelId, UserId, Url, Timestamp, Branded } from './index';
import { 
  OllamaChatMessage, 
  OllamaModel, 
  ApiError,
  ApiResponse
} from './api.types';
import {
  WebviewMessage,
  WebviewMessageType,
  ChatUIMessage
} from './ui.types';

/**
 * Check if a value is defined (not null or undefined)
 * @param value - Value to check
 * @returns True if value is defined
 * @example
 * ```typescript
 * const value: string | undefined = getValue();
 * if (isDefined(value)) {
 *   // value is string here
 *   console.log(value.length);
 * }
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a string
 * @param value - Value to check
 * @returns True if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 * @param value - Value to check
 * @returns True if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if a value is a boolean
 * @param value - Value to check
 * @returns True if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is an object (excluding null)
 * @param value - Value to check
 * @returns True if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 * @param value - Value to check
 * @returns True if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a function
 * @param value - Value to check
 * @returns True if value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Check if a value is a Promise
 * @param value - Value to check
 * @returns True if value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    isObject(value) &&
    'then' in value &&
    isFunction(value.then) &&
    'catch' in value &&
    isFunction(value.catch)
  );
}

/**
 * Check if a value is a valid JSON value
 * @param value - Value to check
 * @returns True if value is a valid JSON value
 */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }
  
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  
  if (type === 'object') {
    return Object.values(value as object).every(isJsonValue);
  }
  
  return false;
}

/**
 * Check if a value is a JSON object
 * @param value - Value to check
 * @returns True if value is a JSON object
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return isObject(value) && isJsonValue(value);
}

/**
 * Check if a value is a JSON array
 * @param value - Value to check
 * @returns True if value is a JSON array
 */
export function isJsonArray(value: unknown): value is JsonArray {
  return isArray(value) && value.every(isJsonValue);
}

/**
 * Check if a value is an Error
 * @param value - Value to check
 * @returns True if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if a value is an ApiError
 * @param value - Value to check
 * @returns True if value is an ApiError
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    isObject(value) &&
    'code' in value &&
    isString(value.code) &&
    'message' in value &&
    isString(value.message)
  );
}

/**
 * Check if a value is an ApiResponse
 * @param value - Value to check
 * @returns True if value is an ApiResponse
 */
export function isApiResponse<T = unknown>(value: unknown): value is ApiResponse<T> {
  return (
    isObject(value) &&
    'data' in value &&
    'status' in value &&
    isNumber(value.status) &&
    'headers' in value &&
    isObject(value.headers)
  );
}

/**
 * Check if a value is an OllamaChatMessage
 * @param value - Value to check
 * @returns True if value is an OllamaChatMessage
 */
export function isOllamaChatMessage(value: unknown): value is OllamaChatMessage {
  return (
    isObject(value) &&
    'role' in value &&
    isString(value.role) &&
    ['system', 'user', 'assistant'].includes(value.role) &&
    'content' in value &&
    isString(value.content)
  );
}

/**
 * Check if a value is an OllamaModel
 * @param value - Value to check
 * @returns True if value is an OllamaModel
 */
export function isOllamaModel(value: unknown): value is OllamaModel {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value.name) &&
    'digest' in value &&
    isString(value.digest) &&
    'size' in value &&
    isNumber(value.size) &&
    'modified_at' in value &&
    isString(value.modified_at)
  );
}

/**
 * Check if a value is a WebviewMessage
 * @param value - Value to check
 * @returns True if value is a WebviewMessage
 */
export function isWebviewMessage(value: unknown): value is WebviewMessage {
  return (
    isObject(value) &&
    'type' in value &&
    isString(value.type) &&
    Object.values(WebviewMessageType).includes(value.type as WebviewMessageType) &&
    'timestamp' in value &&
    isNumber(value.timestamp)
  );
}

/**
 * Check if a value is a ChatUIMessage
 * @param value - Value to check
 * @returns True if value is a ChatUIMessage
 */
export function isChatUIMessage(value: unknown): value is ChatUIMessage {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value.id) &&
    'role' in value &&
    isString(value.role) &&
    ['user', 'assistant', 'system'].includes(value.role) &&
    'content' in value &&
    isString(value.content) &&
    'timestamp' in value &&
    isNumber(value.timestamp)
  );
}

/**
 * Create a type guard for array of specific type
 * @param itemGuard - Type guard for array items
 * @returns Type guard for array
 * @example
 * ```typescript
 * const isStringArray = createArrayGuard(isString);
 * const values: unknown = ['a', 'b', 'c'];
 * if (isStringArray(values)) {
 *   // values is string[]
 * }
 * ```
 */
export function createArrayGuard<T>(
  itemGuard: TypeGuard<T>
): TypeGuard<T[]> {
  return (value: unknown): value is T[] => {
    return isArray(value) && value.every(itemGuard);
  };
}

/**
 * Create a type guard for record of specific type
 * @param valueGuard - Type guard for record values
 * @returns Type guard for record
 * @example
 * ```typescript
 * const isStringRecord = createRecordGuard(isString);
 * const values: unknown = { a: 'hello', b: 'world' };
 * if (isStringRecord(values)) {
 *   // values is Record<string, string>
 * }
 * ```
 */
export function createRecordGuard<T>(
  valueGuard: TypeGuard<T>
): TypeGuard<Record<string, T>> {
  return (value: unknown): value is Record<string, T> => {
    return isObject(value) && Object.values(value).every(valueGuard);
  };
}

/**
 * Create a type guard for nullable type
 * @param guard - Type guard for non-null type
 * @returns Type guard for nullable type
 * @example
 * ```typescript
 * const isNullableString = createNullableGuard(isString);
 * const value: unknown = null;
 * if (isNullableString(value)) {
 *   // value is string | null
 * }
 * ```
 */
export function createNullableGuard<T>(
  guard: TypeGuard<T>
): TypeGuard<T | null | undefined> {
  return (value: unknown): value is T | null | undefined => {
    return value === null || value === undefined || guard(value);
  };
}

/**
 * Create a type guard for union types
 * @param guards - Type guards for union members
 * @returns Type guard for union
 * @example
 * ```typescript
 * const isStringOrNumber = createUnionGuard(isString, isNumber);
 * const value: unknown = 42;
 * if (isStringOrNumber(value)) {
 *   // value is string | number
 * }
 * ```
 */
export function createUnionGuard<T extends unknown[]>(
  ...guards: { [K in keyof T]: TypeGuard<T[K]> }
): TypeGuard<T[number]> {
  return (value: unknown): value is T[number] => {
    return guards.some(guard => guard(value));
  };
}

/**
 * Assert that a value matches a type guard
 * @param value - Value to check
 * @param guard - Type guard function
 * @param message - Error message if assertion fails
 * @throws Error if value doesn't match guard
 * @example
 * ```typescript
 * function processString(value: unknown) {
 *   assertType(value, isString, 'Expected string value');
 *   // value is string here
 *   return value.toUpperCase();
 * }
 * ```
 */
export function assertType<T>(
  value: unknown,
  guard: TypeGuard<T>,
  message: string
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(message);
  }
}

/**
 * Narrow type using a discriminant property
 * @param value - Value to narrow
 * @param property - Discriminant property name
 * @param propertyValue - Expected property value
 * @returns True if value has the expected property value
 * @example
 * ```typescript
 * type Action = 
 *   | { type: 'add'; value: number }
 *   | { type: 'remove'; id: string };
 * 
 * function handleAction(action: Action) {
 *   if (hasProperty(action, 'type', 'add')) {
 *     // action is { type: 'add'; value: number }
 *     console.log(action.value);
 *   }
 * }
 * ```
 */
export function hasProperty<T extends object, K extends keyof T, V extends T[K]>(
  value: T,
  property: K,
  propertyValue: V
): value is T & Record<K, V> {
  return value[property] === propertyValue;
}

/**
 * Type guard for checking if object has required properties
 * @param value - Value to check
 * @param properties - Required property names
 * @returns True if value has all required properties
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   email?: string;
 * }
 * 
 * function isUser(value: unknown): value is User {
 *   return hasProperties(value, ['id', 'name']);
 * }
 * ```
 */
export function hasProperties<K extends string>(
  value: unknown,
  properties: K[]
): value is Record<K, unknown> {
  return isObject(value) && properties.every(prop => prop in value);
}

/**
 * Validate and narrow type with custom validation
 * @param value - Value to validate
 * @param validator - Validation function
 * @returns Validated value or undefined
 * @example
 * ```typescript
 * const email = validate(userInput, (value) => {
 *   if (isString(value) && value.includes('@')) {
 *     return value;
 *   }
 *   return undefined;
 * });
 * ```
 */
export function validate<T>(
  value: unknown,
  validator: (value: unknown) => T | undefined
): T | undefined {
  try {
    return validator(value);
  } catch {
    return undefined;
  }
}

/**
 * Create a branded type from a base value
 * @param value - Base value
 * @returns Branded value
 * @example
 * ```typescript
 * const sessionId = toBranded<SessionId>('session123');
 * ```
 */
export function toBranded<T extends Branded<any, any>>(value: T extends Branded<infer U, any> ? U : never): T {
  return value as T;
}

/**
 * Convert string to SessionId
 * @param value - String value
 * @returns SessionId branded type
 */
export function toSessionId(value: string): SessionId {
  return value as SessionId;
}

/**
 * Convert string to FilePath
 * @param value - String value
 * @returns FilePath branded type
 */
export function toFilePath(value: string): FilePath {
  return value as FilePath;
}

/**
 * Convert string to ModelId
 * @param value - String value
 * @returns ModelId branded type
 */
export function toModelId(value: string): ModelId {
  return value as ModelId;
}

/**
 * Convert string to UserId
 * @param value - String value
 * @returns UserId branded type
 */
export function toUserId(value: string): UserId {
  return value as UserId;
}

/**
 * Convert string to Url
 * @param value - String value
 * @returns Url branded type
 */
export function toUrl(value: string): Url {
  return value as Url;
}

/**
 * Convert number to Timestamp
 * @param value - Number value
 * @returns Timestamp branded type
 */
export function toTimestamp(value: number): Timestamp {
  return value as Timestamp;
}

/**
 * Type guard for SessionId
 * @param value - Value to check
 * @returns True if value is a SessionId
 */
export function isSessionId(value: unknown): value is SessionId {
  return isString(value);
}

/**
 * Type guard for FilePath
 * @param value - Value to check
 * @returns True if value is a FilePath
 */
export function isFilePath(value: unknown): value is FilePath {
  return isString(value);
}

/**
 * Type guard for ModelId
 * @param value - Value to check
 * @returns True if value is a ModelId
 */
export function isModelId(value: unknown): value is ModelId {
  return isString(value);
}

/**
 * Type guard for UserId
 * @param value - Value to check
 * @returns True if value is a UserId
 */
export function isUserId(value: unknown): value is UserId {
  return isString(value);
}

/**
 * Type guard for Url
 * @param value - Value to check
 * @returns True if value is a Url
 */
export function isUrl(value: unknown): value is Url {
  return isString(value);
}

/**
 * Type guard for Timestamp
 * @param value - Value to check
 * @returns True if value is a Timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return isNumber(value);
}