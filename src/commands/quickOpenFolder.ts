import * as vscode from "vscode";

interface FolderQuickPickItem extends vscode.QuickPickItem {
  type?: vscode.FileType;
  uri: vscode.Uri;
}

const doubleDotPath = "..";

const fileTypeName: Record<string, string> = {
  0: "unknown",
  1: "file",
  2: "directory",
  64: "symbolic link",
  65: "file(symbolic link)",
  66: "directory(symbolic link(directory)",
};

function getQuickPickTitle({ shortPath }: { shortPath?: string } = {}) {
  if (!shortPath) {
    return "Go to Folder...";
  }

  return `Go to Folder... [${shortPath}]`;
}

function getQuickPickDesc(
  {
    fileType,
    shortPath,
    fileName,
  }: { fileType?: vscode.FileType; shortPath: string; fileName: string } = {
    fileName: "",
    shortPath: "",
  }
) {
  let desc = "";

  if (fileType && fileTypeName[fileType]) {
    desc += `${fileTypeName[fileType]} - `;
  }

  const shortPathUri = vscode.Uri.from({ scheme: "file", path: shortPath });
  const fileNameUri = vscode.Uri.joinPath(shortPathUri, fileName);

  desc += fileNameUri.path;

  return desc;
}

function getWorkspaceFolderQuickPickItems() {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }

  const items: FolderQuickPickItem[] = [];
  for (const { uri, name } of vscode.workspace.workspaceFolders) {
    items.push({
      uri: uri,
      description: getQuickPickDesc({
        fileType: vscode.FileType.Directory,
        shortPath: `#${name}`,
        fileName: "",
      }),
      label: `#${name}`,
    });
  }

  return items;
}

function getShortPath(path: string) {
  if (!vscode.workspace.workspaceFolders) {
    return path;
  }

  for (const { uri, name } of vscode.workspace.workspaceFolders) {
    const workspacePath = uri.path;
    if (path.startsWith(workspacePath)) {
      return path.replace(workspacePath, `#${name}`);
    }
  }

  return path;
}

async function getQuickPickItems(uri: vscode.Uri, shortPath: string) {
  const list = await vscode.workspace.fs.readDirectory(uri);
  const items: FolderQuickPickItem[] = [];

  if (shortPath.includes("/")) {
    items.push({
      uri: vscode.Uri.joinPath(uri, doubleDotPath),
      description: getQuickPickDesc({
        fileType: vscode.FileType.Directory,
        shortPath,
        fileName: doubleDotPath,
      }),
      label: doubleDotPath,
    });
  }

  const sortedList = list.sort((a, b) => {
    return b[1] - a[1];
  });

  for (const [fileName, fileType] of sortedList) {
    items.push({
      type: fileType,
      uri: vscode.Uri.joinPath(uri, fileName),
      description: getQuickPickDesc({
        fileType,
        shortPath,
        fileName,
      }),
      label: fileName,
    });
  }

  return items;
}

async function pickItem(item: FolderQuickPickItem) {
  const uri = item.uri;

  await vscode.commands.executeCommand("revealInExplorer", uri);
  await vscode.commands.executeCommand("list.expand");

  if (item.type && item.type & vscode.FileType.File) {
    await vscode.commands.executeCommand("vscode.open", uri);
  }

  await showQuickPick(uri);
}

async function showQuickPick(uri: vscode.Uri) {
  const shortPath = getShortPath(uri.path);

  const items = await getQuickPickItems(uri, shortPath);

  if (!items) {
    return;
  }

  const item = await vscode.window.showQuickPick<FolderQuickPickItem>(items, {
    title: getQuickPickTitle({
      shortPath,
    }),
  });

  if (item) {
    pickItem(item);
  }
}

async function showDefaultQuickPick() {
  let shortPath;
  let items: FolderQuickPickItem[] = [];

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri && activeUri.scheme !== "untitled") {
    const activeDirUri = vscode.Uri.joinPath(activeUri, "..");
    shortPath = getShortPath(activeDirUri.path);
    if (shortPath) {
      const activeItems = await getQuickPickItems(activeDirUri, shortPath);
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

  const workspaceItems = getWorkspaceFolderQuickPickItems();
  if (workspaceItems) {
    items.push({
      uri: vscode.Uri.file("/"),
      description: getQuickPickDesc({
        fileType: vscode.FileType.Directory,
        shortPath: `/`,
        fileName: "",
      }),
      label: `/`,
    });
    items = items.concat(workspaceItems);
  }

  const item = await vscode.window.showQuickPick<FolderQuickPickItem>(items, {
    title: getQuickPickTitle({ shortPath }),
  });

  if (item) {
    await pickItem(item);
  }
}

export default async (uri?: vscode.Uri) => {
  if (!uri) {
    await showDefaultQuickPick();
    return true;
  }

  let dirUri = uri;

  const stat = await vscode.workspace.fs.stat(uri);
  if (!(stat.type & vscode.FileType.Directory)) {
    dirUri = vscode.Uri.joinPath(uri, "..");
  }

  await showQuickPick(dirUri);
  return true;
};

export const quickOpenFolderId = "gotofolder.quickOpenFolder";
