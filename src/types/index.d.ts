/**
 * @file Core type definitions for Ollama Dev Companion
 * @module types
 * @description Central type definitions used throughout the extension
 */

import * as vscode from 'vscode';

/**
 * Result type for operations that can fail
 * @template T The type of the success value
 * @template E The type of the error value
 */
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Async result type
 * @template T The type of the success value
 * @template E The type of the error value
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Nullable type helper
 * @template T The type that can be null or undefined
 */
export type Nullable<T> = T | null | undefined;

/**
 * Deep partial type helper
 * @template T The type to make deeply partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : DeepPartial<T[P]>;
};

/**
 * Deep readonly type helper
 * @template T The type to make deeply readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T[P] extends Function
    ? T[P]
    : T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

/**
 * Extract keys of type T that have values of type V
 * @template T The object type
 * @template V The value type to filter by
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Omit properties with specific value types
 * @template T The object type
 * @template V The value type to omit
 */
export type OmitByValue<T, V> = Pick<T, KeysOfType<T, V>>;

/**
 * Constructor type
 * @template T The instance type
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Abstract constructor type
 * @template T The instance type
 */
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

/**
 * Mixin type helper
 * @template T The base type
 * @template U The mixin type
 */
export type Mixin<T, U> = T & U;

/**
 * Type guard function type
 * @template T The type to guard
 */
export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * Predicate function type
 * @template T The input type
 */
export type Predicate<T> = (value: T) => boolean;

/**
 * Comparator function type
 * @template T The type to compare
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Factory function type
 * @template T The type to create
 * @template P The parameter type
 */
export type Factory<T, P = void> = (params: P) => T;

/**
 * Async factory function type
 * @template T The type to create
 * @template P The parameter type
 */
export type AsyncFactory<T, P = void> = (params: P) => Promise<T>;

/**
 * Event handler type
 * @template T The event data type
 */
export type EventHandler<T = void> = (event: T) => void | Promise<void>;

/**
 * Disposable pattern interface
 */
export interface IDisposable {
  dispose(): void;
}

/**
 * Async disposable pattern interface
 */
export interface IAsyncDisposable {
  disposeAsync(): Promise<void>;
}

/**
 * JSON serializable types
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * Branded type helper for nominal typing
 * @template T The base type
 * @template Brand The brand identifier
 */
export type Branded<T, Brand extends string> = T & { __brand: Brand };

/**
 * Common branded types
 */
export type UserId = Branded<string, 'UserId'>;
export type SessionId = Branded<string, 'SessionId'>;
export type ModelId = Branded<string, 'ModelId'>;
export type FilePath = Branded<string, 'FilePath'>;
export type Url = Branded<string, 'Url'>;
export type Timestamp = Branded<number, 'Timestamp'>;

/**
 * Extension context with additional properties
 */
export interface ExtensionContext extends vscode.ExtensionContext {
  isDevelopment?: boolean;
  isTest?: boolean;
}

/**
 * Logger interface
 */
export interface ILogger {
  trace(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string | Error, ...args: any[]): void;
  fatal(message: string | Error, ...args: any[]): void;
}

/**
 * Progress reporter interface
 */
export interface IProgressReporter {
  report(value: { message?: string; increment?: number }): void;
}

/**
 * Cancellation token source interface
 */
export interface ICancellationTokenSource {
  readonly token: vscode.CancellationToken;
  cancel(): void;
  dispose(): void;
}

/**
 * Common error types
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class CancellationError extends Error {
  constructor(message: string = 'Operation cancelled') {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Re-export commonly used VS Code types
 */
export type {
  CancellationToken,
  Disposable,
  Event,
  EventEmitter,
  Uri,
  Range,
  Position,
  TextDocument,
  TextEditor,
  WorkspaceConfiguration
} from 'vscode';