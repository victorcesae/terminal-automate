"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const extension = "terminal-automate";
function activate(context) {
    const disposables = [];
    const dynamicCommand = vscode.commands.registerCommand(`${extension}.dynamicCommand`, async () => {
        const config = vscode.workspace.getConfiguration(extension);
        const commands = config.get("commands") || [];
        const selectedCommand = await vscode.window.showQuickPick(getAvailableCommands(commands), { placeHolder: "Selecione um comando" });
        if (selectedCommand) {
            const command = commands.find((cmd) => cmd.command === selectedCommand.label);
            if (command) {
                executeCommand(command);
            }
        }
    });
    const openFormCommand = vscode.commands.registerCommand(`${extension}.openForm`, async () => {
        const config = vscode.workspace.getConfiguration(extension);
        const commands = config.get("commands") || [];
        const commandName = await vscode.window.showInputBox({
            prompt: "Digite o nome da ação",
        });
        if (commandName) {
            const sequence = await openSequenceForm();
            if (sequence) {
                const newCommand = {
                    command: commandName,
                    sequence: sequence,
                };
                commands.push(newCommand);
                await saveCommandsToSettings(commands, extension);
                vscode.window.showInformationMessage(`Comando "${commandName}" adicionado com sucesso.`);
            }
        }
    });
    disposables.push(openFormCommand);
    disposables.push(dynamicCommand);
    context.subscriptions.push(...disposables);
    // Prompt the user to register a sequence after installation
    vscode.window
        .showInformationMessage("Welcome to Terminal Automate! Do you want to register a sequence?", "Yes", "No")
        .then((selection) => {
        if (selection === "Yes") {
            vscode.commands.executeCommand(`${extension}.openForm`);
        }
    });
}
exports.activate = activate;
function getAvailableCommands(commands) {
    return commands.map((cmd) => ({
        label: cmd.command,
    }));
}
async function executeCommand(command) {
    const { sequence } = command;
    for (const step of sequence) {
        if (step.hasOwnProperty("terminal")) {
            const terminalName = step.terminal;
            let terminal = vscode.window.terminals.find((term) => term.name === terminalName);
            if (!terminal) {
                terminal = vscode.window.createTerminal({ name: terminalName });
            }
            await vscode.window.showInformationMessage(`Executando comando no terminal "${terminal.name}"`);
            // Envia o texto para o terminal usando o comando 'workbench.action.terminal.sendSequence'
            await vscode.commands.executeCommand("workbench.action.terminal.sendSequence", {
                text: step.text,
                preserveFocus: true,
                addToHistory: true,
                waitForPrompt: true,
            });
        }
        else if (step.hasOwnProperty("text")) {
            await vscode.commands.executeCommand("workbench.action.terminal.sendSequence", {
                text: step.text,
                preserveFocus: true,
                addToHistory: true,
                waitForPrompt: true,
            });
        }
        else {
            vscode.window.showErrorMessage(`Passo inválido na sequência do comando.`);
        }
    }
}
async function openSequenceForm() {
    const steps = [];
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
            prompt: "Digite o nome do terminal (deixe em branco para usar o nome default)",
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
async function saveCommandsToSettings(commands, extensionName) {
    const config = vscode.workspace.getConfiguration(extensionName);
    await config.update("commands", commands, vscode.ConfigurationTarget.Global);
}
function combineFirstTwoWords(str) {
    const words = str.trim().split(" ");
    if (words.length >= 2) {
        return words[0] + "-" + words[1];
    }
    else {
        return words[0];
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map