// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import ollama from "ollama";
import { registerInlineCompletionProvider } from "./inlineCompletionProvider/inlineCompletionProvider";
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration();
	let selectedModel = config.get<string>("ollama.defaultModel");

	if (!selectedModel) {
		const availableModels = await getAvailableOllamaModels();

		if (availableModels.length === 0) {
			vscode.window.showWarningMessage("No models found");
			return;
		}

		const model = await vscode.window.showQuickPick(availableModels, {
			placeHolder: "Select a model",
			matchOnDetail: true,
		});

		if (model) {
			selectedModel = model.label;
			await config.update("ollama.defaultModel", selectedModel, true);
			vscode.window.showInformationMessage(`Selected model: ${selectedModel}`);
		}
	}

	console.log(selectedModel);

	registerInlineCompletionProvider(context);
}

async function getAvailableOllamaModels() {
	const availableModels = (await ollama.list()).models.map((model) => {
		return { label: model.name, details: `${model.details.family} ${model.details.parameter_size}` };
	});
	return availableModels;
}


// This method is called when your extension is deactivated
export function deactivate() {}
