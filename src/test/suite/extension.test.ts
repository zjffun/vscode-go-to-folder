import * as assert from "assert";
import * as vscode from "vscode";
import { quickOpenFolderId } from "../../commands/quickOpenFolder";

suite("Extension", () => {
  const extensionID = "zjffun.gotofolder";
  const extensionShortName = "gotofolder";

  const extension = vscode.extensions.getExtension(extensionID);

  setup(async () => {});

  teardown(async () => {});

  test("All package.json commands should be registered in extension", (done) => {
    if (!extension) {
      throw Error("can't find extension");
    }

    const packageCommands = extension.packageJSON.contributes.commands.map(
      (c: any) => c.command,
    );

    // get all extension commands excluding internal commands.
    vscode.commands.getCommands(true).then((allCommands) => {
      const activeCommands = allCommands.filter((c) =>
        c.startsWith(`${extensionShortName}.`),
      );

      activeCommands.forEach((command) => {
        const result = packageCommands.some((c: any) => c === command);
        assert.ok(result);
      });

      done();
    });
  });

  // TODO
  // test("quickOpenFolder command should work", async () => {
  //   await vscode.commands.executeCommand(quickOpenFolderId);
  // });
});
