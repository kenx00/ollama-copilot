import ollama from 'ollama';
import * as vscode from 'vscode';
// Removed unused import
import { sanitizeModelName } from './sanitization';

/**
 * Initializes the Ollama client and tests the connection
 */
export async function initializeOllamaClient(): Promise<boolean> {
  try {
    const config = vscode.workspace.getConfiguration('ollama');
    const apiHost = config.get<string>('apiHost') || 'http://localhost:11434';
    
    // Log debugging information about Ollama client
    console.log('Ollama client:', ollama);
    console.log('Trying to connect to Ollama at:', apiHost);
    
    // Test connection by getting a list of models
    await ollama.list();
    console.log('Successfully connected to Ollama');
    return true;
  } catch (error) {
    console.error('Failed to connect to Ollama:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Could not connect to Ollama: ${errorMessage}. ` +
      `Make sure the Ollama server is running and accessible.`
    );
    return false;
  }
}

/**
 * Interface for model information
 */
export interface ModelInfo {
  label: string;
  details?: string;
}

/**
 * Gets the available Ollama models
 */
export async function getAvailableOllamaModels(): Promise<ModelInfo[]> {
  const maxRetries = 3;
  let retries = 0;
  let lastError = null;
  // Validation service removed - using direct validation
  
  while (retries < maxRetries) {
    try {
      const config = vscode.workspace.getConfiguration('ollama');
      const apiHost = config.get<string>('apiHost') || 'http://localhost:11434';
      
      // Basic URL validation
      try {
        const url = new URL(apiHost);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        throw new Error(`Invalid API host URL: ${apiHost}`);
      }
      
      // For debugging
      console.log(`Attempt ${retries + 1} to get models from: ${apiHost}`);
      
      const response = await ollama.list();
      
      if (!response || !response.models || !Array.isArray(response.models)) {
        console.error('Invalid response format from Ollama.list():', response);
        throw new Error('Invalid response format from Ollama API');
      }
      
      console.log(`Successfully retrieved ${response.models.length} models from Ollama`);
      
      const availableModels = response.models.map((model) => {
        // Sanitize model name
        const sanitizedName = sanitizeModelName(model.name);
        return {
          label: sanitizedName,
          details: model.details ? `${model.details.family || ''} ${model.details.parameter_size || ''}`.trim() : ''
        };
      });
      
      return availableModels;
    } catch (error) {
      lastError = error;
      console.error(`Error getting Ollama models (attempt ${retries + 1}):`, error);
      retries++;
      
      if (retries < maxRetries) {
        // Wait for a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // If we've exhausted all retries, show the error
  vscode.window.showErrorMessage(`Failed to get Ollama models: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  return [];
}

/**
 * Gets the selected model from configuration
 */
export async function getSelectedModel(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('ollama');
  const selectedModel = config.get<string>('defaultModel');
  
  if (selectedModel) {
    return selectedModel;
  }
  
  const availableModels = await getAvailableOllamaModels();
  if (availableModels.length === 0) {
    vscode.window.showWarningMessage('No Ollama models found');
    return undefined;
  }
  
  const model = await vscode.window.showQuickPick(availableModels, {
    placeHolder: 'Select a model',
    matchOnDetail: true,
  });
  
  if (model) {
    // Validate model name before saving
    // Validation service removed - using direct validation
    const sanitizedModel = sanitizeModelName(model.label);
    
    if (sanitizedModel) {
      await config.update('ollama.defaultModel', sanitizedModel, true);
      vscode.window.showInformationMessage(`Selected model: ${sanitizedModel}`);
      return sanitizedModel;
    } else {
      vscode.window.showErrorMessage(`Invalid model name: ${model.label}`);
      return undefined;
    }
  }
  
  return undefined;
} 