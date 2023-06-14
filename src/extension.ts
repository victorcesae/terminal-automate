import * as vscode from "vscode";
interface sequence {
  text: string;
  terminal: string;
}
interface CommandConfig {
  command: string;
  sequence: sequence[];
}

const extension = "terminal-automate";

export function activate(context: vscode.ExtensionContext) {
  const disposables: vscode.Disposable[] = [];
  const dynamicCommand = vscode.commands.registerCommand(
    `${extension}.dynamicCommand`,
    async () => {
      const config = vscode.workspace.getConfiguration(extension);
      const commands: CommandConfig[] = config.get("commands") || [];
      const selectedCommand = await vscode.window.showQuickPick(
        getAvailableCommands(commands),
        { placeHolder: "Selecione um comando" }
      );
      if (selectedCommand) {
        const command = commands.find(
          (cmd) => cmd.command === selectedCommand.label
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
      const commandName = await vscode.window.showInputBox({
        prompt: "Digite o nome da ação",
      });
      if (commandName) {
        const sequence = await openSequenceForm();
        if (sequence) {
          const newCommand: CommandConfig = {
            command: commandName,
            sequence: sequence,
          };
          commands.push(newCommand);

          await saveCommandsToSettings(commands, extension);
          vscode.window.showInformationMessage(
            `Comando "${commandName}" adicionado com sucesso.`
          );
        }
      }
    }
  );

  disposables.push(openFormCommand);

  disposables.push(dynamicCommand);

  context.subscriptions.push(...disposables);

  // Prompt the user to register a sequence after installation
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
}

function getAvailableCommands(
  commands: CommandConfig[]
): vscode.QuickPickItem[] {
  return commands.map((cmd) => ({
    label: cmd.command,
  }));
}

async function executeCommand(command: CommandConfig): Promise<void> {
  const { sequence, command: commandName } = command;

  vscode.window.showInformationMessage(
    `Executando comando no terminal "${commandName}"!`
  );
  for (const step of sequence) {
    if (step.hasOwnProperty("terminal") && step.hasOwnProperty("text")) {
      const terminalName = step.terminal;
      let terminal = vscode.window.terminals.find(
        (term) => term.name === terminalName
      );

      if (!terminal) {
        terminal = vscode.window.createTerminal({ name: terminalName });
      }

      // Envia o texto para o terminal usando o comando 'workbench.action.terminal.sendSequence'
      terminal.sendText(step.text);
    } else {
      vscode.window.showErrorMessage(`Passo inválido na sequência do comando.`);
    }
  }
  vscode.window.showInformationMessage(`Comando "${commandName}" executado!`);
}

async function openSequenceForm(): Promise<sequence[] | undefined> {
  const steps: sequence[] = [];
  let terminal = -1;
  while (true) {
    terminal++;
    const stepText = await vscode.window.showInputBox({
      prompt: "Digite o comando para o próximo passo",
    });
    if (!stepText) {
      break;
    }

    const stepTerminal = await vscode.window.showInputBox({
      prompt:
        "Digite o nome do terminal (deixe em branco para usar o nome default)",
    });

    const step = {
      text: stepText,
      terminal: stepTerminal ?? `${combineFirstTwoWords(stepText)}`,
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
export function deactivate() {}
