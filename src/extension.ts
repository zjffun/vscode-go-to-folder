import * as vscode from "vscode";

import quickOpenFolder, { quickOpenFolderId } from "./commands/quickOpenFolder";

export const log = vscode.window.createOutputChannel("Go to Folder");

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(quickOpenFolderId, quickOpenFolder)
  );
}

export function deactivate() {}
