// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import UI5ControlGenerator from './generator/UI5ControlGenerator';
import UI5ModelGenerator from './generator/UI5ModelGenerator';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('ui5-ts-codegen is now active');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('ui5-ts-codegen.modelGenerator', () => {

		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage(`Running JSONModel code generator for ${filename}`);

        let generator = new UI5ModelGenerator();
        generator.process();
	}));

    // The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('ui5-ts-codegen.controlGenerator', () => {

		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage(`Running JSONModel code generator for ${filename}`);

        let generator = new UI5ControlGenerator();
        generator.process();
	}));

}

// this method is called when your extension is deactivated
export function deactivate() {}
