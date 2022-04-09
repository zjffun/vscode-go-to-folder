import * as vscode from "vscode";

interface FolderQuickPickItem extends vscode.QuickPickItem {
  folderUri: vscode.Uri;
}

function getWorkspaceFolderPickItems() {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }

  const items: FolderQuickPickItem[] = [];
  for (const { uri, name } of vscode.workspace.workspaceFolders) {
    items.push({
      folderUri: uri,
      description: `#${name}`,
      label: `#${name}`,
    });
  }

  return items;
}

function getWorkspacePath(uri: vscode.Uri) {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }

  const dirPath = uri.path;

  for (const { uri, name } of vscode.workspace.workspaceFolders) {
    const wsPath = uri.path;
    if (dirPath.startsWith(wsPath)) {
      return dirPath.replace(wsPath, `#${name}`);
    }
  }

  return undefined;
}

async function getPickItems(uri: vscode.Uri, wsPath: string) {
  const list = await vscode.workspace.fs.readDirectory(uri);
  const items: FolderQuickPickItem[] = [];

  if (wsPath.includes("/")) {
    items.push({
      folderUri: vscode.Uri.joinPath(uri, ".."),
      description: wsPath.replace(/\/.*?$/, ""),
      label: "..",
    });
  }

  for (const [fileName, fileType] of list) {
    if (fileType & (vscode.FileType.Directory | vscode.FileType.SymbolicLink)) {
      items.push({
        folderUri: vscode.Uri.joinPath(uri, fileName),
        description: `${wsPath}/${fileName}`,
        label: fileName,
      });
    }
  }

  return items;
}

async function showPick(uri: vscode.Uri) {
  let uri_ = uri;
  while (true) {
    const wsPath = getWorkspacePath(uri_);

    if (!wsPath) {
      return;
    }

    const items = await getPickItems(uri_, wsPath);

    if (!items) {
      return;
    }

    const item = await vscode.window.showQuickPick<FolderQuickPickItem>(items, {
      title: `Go to Folder... [${wsPath}]`,
    });

    if (!item) {
      return;
    }

    if (item) {
      uri_ = item.folderUri;
      await vscode.commands.executeCommand("revealInExplorer", item.folderUri);
      await vscode.commands.executeCommand("list.expand");
    }
  }
}

async function showDefaultPick() {
  let items: FolderQuickPickItem[] = [];

  const workspaceItems = getWorkspaceFolderPickItems();
  if (workspaceItems) {
    items = items.concat(workspaceItems);
    items.push({
      folderUri: vscode.Uri.file(""),
      kind: vscode.QuickPickItemKind.Separator,
      label: "",
    });
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const activateFolderUri = vscode.Uri.joinPath(activeUri, "..");
    const activateFolderPath = getWorkspacePath(
      vscode.Uri.joinPath(activeUri, "..")
    );
    if (activateFolderPath) {
      items.push({
        folderUri: activateFolderUri,
        label: activateFolderPath,
      });
    }
  }

  const item = await vscode.window.showQuickPick<FolderQuickPickItem>(items, {
    title: "Go to Folder...",
  });

  if (item) {
    await showPick(item.folderUri);
  }
}

export default async (uri?: vscode.Uri) => {
  if (!uri) {
    await showDefaultPick();
    return true;
  }

  await showPick(uri);
  return true;
};

export const quickOpenFolderId = "gotofolder.quickOpenFolder";
