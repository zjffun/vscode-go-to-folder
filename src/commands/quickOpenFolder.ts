import * as vscode from "vscode";

interface FolderQuickPickItem extends vscode.QuickPickItem {
  type?: vscode.FileType;
  uri: vscode.Uri;
}

const fileTypeName = {
  0: "unknown",
  1: "file",
  2: "directory",
  64: "symbolic link",
  65: "file(symbolic link)",
  66: "directory(symbolic link(directory)",
};

function getWorkspaceFolderPickItems() {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }

  const items: FolderQuickPickItem[] = [];
  for (const { uri, name } of vscode.workspace.workspaceFolders) {
    items.push({
      uri: uri,
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
      uri: vscode.Uri.joinPath(uri, ".."),
      description: wsPath.replace(/\/.*?$/, ""),
      label: "..",
    });
  }

  const sortedList = list.sort((a, b) => {
    return b[1] - a[1];
  });

  for (const [fileName, fileType] of sortedList) {
    items.push({
      type: fileType,
      uri: vscode.Uri.joinPath(uri, fileName),
      description: `${fileTypeName[fileType]} - ${wsPath}/${fileName}`,
      label: fileName,
    });
  }

  return items;
}

async function showPick(uri: vscode.Uri) {
  let currentUri = uri;
  while (true) {
    const wsPath = getWorkspacePath(currentUri);

    if (!wsPath) {
      return;
    }

    const items = await getPickItems(currentUri, wsPath);

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
      currentUri = item.uri;
      await vscode.commands.executeCommand("revealInExplorer", item.uri);
      await vscode.commands.executeCommand("list.expand");

      if (item.type && item.type & vscode.FileType.File) {
        await vscode.commands.executeCommand("vscode.open", item.uri);
        continue;
      }
    }
  }
}

async function showDefaultPick() {
  let items: FolderQuickPickItem[] = [];

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const activeFolderUri = vscode.Uri.joinPath(activeUri, "..");
    const wsPath = getWorkspacePath(activeFolderUri);
    if (wsPath) {
      const activeItems = await getPickItems(activeFolderUri, wsPath);
      items = items.concat(activeItems);
    }
  }

  if (items.length > 0) {
    items.push({
      uri: vscode.Uri.file(""),
      kind: vscode.QuickPickItemKind.Separator,
      label: "",
    });
  }

  const workspaceItems = getWorkspaceFolderPickItems();
  if (workspaceItems) {
    items = items.concat(workspaceItems);
  }

  const item = await vscode.window.showQuickPick<FolderQuickPickItem>(items, {
    title: "Go to Folder...",
  });

  if (item) {
    await showPick(item.uri);
  }
}

export default async (uri?: vscode.Uri) => {
  if (!uri) {
    await showDefaultPick();
    return true;
  }

  let _uri = uri;

  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.type !== vscode.FileType.Directory) {
    _uri = vscode.Uri.joinPath(uri, "..");
  }

  await showPick(_uri);
  return true;
};

export const quickOpenFolderId = "gotofolder.quickOpenFolder";
