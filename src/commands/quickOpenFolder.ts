import * as vscode from "vscode";

interface FolderQuickPickItem extends vscode.QuickPickItem {
  type?: vscode.FileType;
  uri: vscode.Uri;
}

enum ButtonId {
  GoToFile = "go-to-file",
  OpenFolder = "folder-opened",
}

const doubleDotPath = "..";

const quickPick = vscode.window.createQuickPick<FolderQuickPickItem>();

quickPick.placeholder = "Search folders or files by name";

quickPick.onDidAccept(
  getShowErrorFunction(async () => {
    const item = quickPick?.selectedItems?.[0];
    if (item) {
      await acceptItem(item);
    }
  }),
);

quickPick.onDidTriggerItemButton(
  getShowErrorFunction(
    async ({
      button,
      item,
    }: {
      button: vscode.QuickInputButton;
      item: FolderQuickPickItem;
    }) => {
      if (item.type === undefined) {
        return;
      }

      const buttonId = (button.iconPath as vscode.ThemeIcon)?.id;

      if (buttonId === ButtonId.GoToFile && item.type & vscode.FileType.File) {
        await acceptItem(item);
        return;
      }

      if (
        buttonId === ButtonId.OpenFolder &&
        item.type & vscode.FileType.Directory
      ) {
        await vscode.commands.executeCommand("vscode.openFolder", item.uri, {
          forceNewWindow: true,
        });
        quickPick.hide();
        return;
      }
    },
  ),
);

const fileTypeName: Record<string, string> = {
  0: "unknown",
  1: "file",
  2: "directory",
  64: "symbolic link",
  65: "file(symbolic link)",
  66: "directory(symbolic link(directory)",
};

function showError(error: any) {
  vscode.window.showErrorMessage(
    `Go to Folder ${error?.message || error?.toString?.()}`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function getShowErrorFunction(this: any, fn: Function) {
  const _this = this;

  return async function (...args: any[]) {
    try {
      // await here, otherwise the error may not be caught.
      const result = await fn.apply(_this, args);
      return result;
    } catch (error: any) {
      showError(error);
    }
  };
}

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
  },
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
    items.push(
      getItem({
        type: vscode.FileType.Directory,
        uri: uri,
        description: getQuickPickDesc({
          fileType: vscode.FileType.Directory,
          shortPath: `#${name}`,
          fileName: "",
        }),
        label: `#${name}`,
      }),
    );
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

function getButtons(fileType: vscode.FileType) {
  const buttons: vscode.QuickInputButton[] = [];

  if (fileType & vscode.FileType.File) {
    buttons.push({
      iconPath: new vscode.ThemeIcon(ButtonId.GoToFile),
      tooltip: "Open file",
    });
  } else if (fileType & vscode.FileType.Directory) {
    buttons.push({
      iconPath: new vscode.ThemeIcon(ButtonId.OpenFolder),
      tooltip: "Open folder in new window",
    });
  }

  return buttons;
}

async function getDirUri(uri: vscode.Uri) {
  let dirUri = uri;

  const stat = await vscode.workspace.fs.stat(uri);
  if (!(stat.type & vscode.FileType.Directory)) {
    dirUri = vscode.Uri.joinPath(uri, "..");
  }

  return dirUri;
}

function getItem({
  uri,
  type,
  description,
  label,
}: {
  uri: vscode.Uri;
  type: vscode.FileType;
  description: string;
  label: string;
}) {
  const item = {
    type,
    uri,
    description,
    label,
    buttons: getButtons(type),
  };

  return item;
}

async function getQuickPickItems(uri: vscode.Uri, shortPath: string) {
  const items: FolderQuickPickItem[] = [];

  if (shortPath.includes("/")) {
    items.push(
      getItem({
        type: vscode.FileType.Directory,
        uri: vscode.Uri.joinPath(uri, doubleDotPath),
        description: getQuickPickDesc({
          fileType: vscode.FileType.Directory,
          shortPath,
          fileName: doubleDotPath,
        }),
        label: doubleDotPath,
      }),
    );
  }

  let list: [string, vscode.FileType][] = [];
  try {
    list = await vscode.workspace.fs.readDirectory(uri);
  } catch (error) {
    showError(error);
    return items;
  }

  const sortedList = list.sort((a, b) => {
    return b[1] - a[1];
  });

  for (const [fileName, fileType] of sortedList) {
    items.push(
      getItem({
        type: fileType,
        uri: vscode.Uri.joinPath(uri, fileName),
        description: getQuickPickDesc({
          fileType,
          shortPath,
          fileName,
        }),
        label: fileName,
      }),
    );
  }

  return items;
}

async function acceptItem(item: FolderQuickPickItem) {
  const uri = item.uri;

  await vscode.commands.executeCommand("revealInExplorer", uri);
  await vscode.commands.executeCommand("list.expand");

  if (item.type && item.type & vscode.FileType.File) {
    await vscode.commands.executeCommand("vscode.open", uri);
    quickPick.hide();
  } else if (item.type && item.type & vscode.FileType.Directory) {
    quickPick.busy = true;
    await showDirUriQuickPick(uri);
  }
}

function showQuickPick({
  items,
  shortPath,
}: {
  items: FolderQuickPickItem[];
  shortPath?: string;
}) {
  quickPick.items = items;
  quickPick.title = getQuickPickTitle({ shortPath });
  quickPick.value = "";
  quickPick.busy = false;
  quickPick.show();
}

async function showDirUriQuickPick(uri: vscode.Uri) {
  const shortPath = getShortPath(uri.path);

  const items = await getQuickPickItems(uri, shortPath);

  if (!items) {
    return;
  }

  showQuickPick({ items, shortPath });
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

  items.push(
    getItem({
      type: vscode.FileType.Directory,
      uri: vscode.Uri.file("/"),
      description: getQuickPickDesc({
        fileType: vscode.FileType.Directory,
        shortPath: `/`,
        fileName: "",
      }),
      label: `/`,
    }),
  );

  const workspaceItems = getWorkspaceFolderQuickPickItems();
  if (workspaceItems) {
    items = items.concat(workspaceItems);
  }

  showQuickPick({ items, shortPath });
}

export default getShowErrorFunction(async (uri?: vscode.Uri) => {
  if (!uri) {
    await showDefaultQuickPick();
    return;
  }

  const dirUri = await getDirUri(uri);

  await showDirUriQuickPick(dirUri);
});

export const quickOpenFolderId = "gotofolder.quickOpenFolder";
