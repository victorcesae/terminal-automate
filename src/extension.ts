import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
interface sequence {
  text: string;
  terminal: string;
  id: string;
}
interface CommandConfig {
  command: string;
  sequences: sequence[];
  id: string;
}

const extension = "terminal-automate";

export async function activate(context: vscode.ExtensionContext) {
  const disposables: vscode.Disposable[] = [];
  const dynamicCommand = vscode.commands.registerCommand(
    `${extension}.dynamicCommand`,
    async () => {
      const config = vscode.workspace.getConfiguration(extension);
      const commands: CommandConfig[] = config.get("commands") || [];
      const selectedCommand = await vscode.window.showQuickPick(
        getAvailableCommands(commands),
        { placeHolder: "Select a command" }
      );
      if (selectedCommand) {
        const command = commands.find(
          (cmd) => cmd.id === selectedCommand.description
        );
        if (command) {
          executeCommand(command);
        }
      }
    }
  );

  const openFormCommand = vscode.commands.registerCommand(
    `${extension}.openForm`,
    async () => {
      const config = vscode.workspace.getConfiguration(extension);
      const commands: CommandConfig[] = config.get("commands") || [];
      const quickItems = getAvailableCommands(commands);

      const selectedCommand = await vscode.window.showQuickPick(
        [
          { label: "Add or Edit a command", description: "addOrEdit" },
          ...(commands && commands.length > 0
            ? [
                {
                  label: "Delete a command",
                  description: "delete",
                },
              ]
            : []),
        ],
        { placeHolder: "Select a operation type" }
      );
      if (selectedCommand) {
        switch (selectedCommand.description) {
          case "addOrEdit":
            await addOrEditCommand(commands, quickItems);
            break;
          case "delete":
            await removeCommand(commands, quickItems);
            break;
          default:
            break;
        }
      }
    }
  );

  disposables.push(openFormCommand);

  disposables.push(dynamicCommand);

  context.subscriptions.push(...disposables);

  vscode.window
    .showInformationMessage(
      "Welcome to Terminal Automate! Do you want to register a sequence?",
      "Yes",
      "No"
    )
    .then((selection) => {
      if (selection === "Yes") {
        vscode.commands.executeCommand(`${extension}.openForm`);
      }
    });
  // Prompt the user to register a sequence after installation
}

function getAvailableCommands(
  commands: CommandConfig[]
): vscode.QuickPickItem[] {
  return commands.map((cmd) => ({
    label: cmd.command,
    description: cmd.id,
  }));
}

async function executeCommand(command: CommandConfig): Promise<void> {
  const { sequences, command: commandName } = command;

  vscode.window.showInformationMessage(
    `Executing command in terminal "${commandName}" !`
  );
  for (const sequence of sequences) {
    if (
      sequence.hasOwnProperty("terminal") &&
      sequence.hasOwnProperty("text")
    ) {
      const terminalName = sequence.terminal;
      let terminal = vscode.window.terminals.find(
        (term) => term.name === terminalName
      );

      if (!terminal) {
        terminal = vscode.window.createTerminal({ name: terminalName });
      }

      // Envia o texto para o terminal usando o comando 'workbench.action.terminal.sendSequence'
      terminal.sendText(sequence.text);
    } else {
      vscode.window.showErrorMessage(`Invalid sequence in command sequence.`);
    }
  }
  vscode.window.showInformationMessage(`Command "${commandName}" executed!`);
}

async function openSequenceForm(
  command?: CommandConfig
): Promise<sequence[] | undefined> {
  const steps: sequence[] = [];
  let terminal = -1;
  while (true) {
    terminal++;
    const stepText = await vscode.window.showInputBox({
      prompt: "Enter the command for the next step",
      value: command?.sequences?.[terminal]?.text,
    });
    if (!stepText) {
      if (command?.sequences?.[terminal])
        command?.sequences?.splice(terminal, 1);
      break;
    }

    const stepTerminal = await vscode.window.showInputBox({
      prompt:
        "Enter the name of the terminal (leave blank to use the default name)",
      value: command?.sequences[terminal]?.terminal,
    });

    const step = {
      text: stepText,
      terminal: stepTerminal ?? `${combineFirstTwoWords(stepText)}-${terminal}`,
      id: command?.sequences[terminal]?.id ?? uuidv4(),
    };

    steps.push(step);
  }

  if (steps.length > 0) {
    return steps;
  }

  return undefined;
}

async function saveCommandsToSettings(
  commands: CommandConfig[],
  extensionName: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration(extensionName);
  await config.update("commands", commands, vscode.ConfigurationTarget.Global);
}

function combineFirstTwoWords(str: string): string {
  const words = str.trim().split(" ");
  if (words.length >= 2) {
    return words[0] + "-" + words[1];
  } else {
    return words[0];
  }
}

async function addOrEditCommand(
  commands: CommandConfig[],
  quickItems: vscode.QuickPickItem[]
) {
  const selectedCommand = await vscode.window.showQuickPick(
    [...[{ label: "Add new command", description: "new" }], ...quickItems],
    {
      placeHolder: "Select a command to edit or create a new one",
    }
  );
  if (selectedCommand) {
    const isNewCommand = selectedCommand.description === "new";
    const command = isNewCommand
      ? undefined
      : commands.find((cmd) => cmd.id === selectedCommand.description);

    let commandName = isNewCommand ? undefined : selectedCommand.label;
    commandName = await vscode.window.showInputBox({
      prompt: "Enter the action name",
      value: command?.command,
    });
    if (!commandName) return;
    if (commandName === "Add new command") {
      vscode.window.showErrorMessage(`Invalid command name (reserved name).`);
      return;
    }
    const sequences = await openSequenceForm(
      isNewCommand ? undefined : command
    );
    if (!sequences) {
      if (isNewCommand) {
        commands?.splice(
          commands.findIndex((cmd) => cmd.id === command?.id),
          1
        );
      }
      return;
    }
    const newCommand: CommandConfig = {
      command: commandName,
      sequences: sequences,
      id: command?.id ?? uuidv4(),
    };
    if (isNewCommand) {
      commands.push(newCommand);
    } else {
      commands.map((cmd) => {
        if (cmd.id === newCommand.id) {
          cmd.command = newCommand.command;
          newCommand.sequences.map((newSequence) => {
            const oldSeqIndex = cmd.sequences.findIndex(
              (sqc) => sqc.id === newSequence.id
            );
            if (oldSeqIndex > -1) {
              cmd.sequences[oldSeqIndex] = newSequence;
            } else {
              cmd.sequences.push(newSequence);
            }
          });
        }
      });
    }

    await saveCommandsToSettings(commands, extension);
    vscode.window.showInformationMessage(
      `Command "${commandName}" successfully added.`
    );
  }
}
async function removeCommand(
  commands: CommandConfig[],
  quickItems: vscode.QuickPickItem[]
) {
  const selectedCommand = await vscode.window.showQuickPick(quickItems, {
    placeHolder: "Select a command to delete",
  });
  if (selectedCommand) {
    const index = commands.findIndex(
      (cmd) => cmd.id === selectedCommand.description
    );
    const command = commands[index];
    commands.splice(
      commands.findIndex((cmd) => cmd.id === selectedCommand.description),
      1
    );

    await saveCommandsToSettings(commands, extension);
    vscode.window.showInformationMessage(
      `Command "${command.command}" successfully deleted.`
    );
  }
}
export function deactivate() {}
