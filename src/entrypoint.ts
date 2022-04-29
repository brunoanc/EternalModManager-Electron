import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { spawn, spawnSync } from 'child_process';
import { app, ipcMain, dialog, BrowserWindow } from 'electron';

// Get game path
let gamePath: string = process.env['PORTABLE_EXECUTABLE_DIR'] || '';
let argPath = ''

if (process.argv[0].endsWith('electron') || process.argv[0].endsWith('electron.exe')) {
    argPath = process.argv[2] || '';
}
else {
    argPath = process.argv[1] || '';
}

if (argPath.startsWith('--')) {
    argPath = '';
}

if (argPath.length > 0) {
    gamePath = path.isAbsolute(argPath) ? argPath : path.join(gamePath, argPath);
}

const configPath = path.join(app.getPath('userData'), 'config.json');
let injectorPath = ''
let errorType = '';
let mainWindow: BrowserWindow;

// Replicate modal window functionality
// Needed to work around macOS removing title bar in modal windows
function disableWindow(window: BrowserWindow): void {
    if (process.platform === 'darwin') {
        window.webContents.executeJavaScript('document.body.style.pointerEvents = \'none\';');
        window.setFocusable(false);
    }
}

function reEnableWindow(window: BrowserWindow): void {
    if (process.platform === 'darwin') {
        window.webContents.executeJavaScript('document.body.style.pointerEvents = \'auto\';');
        window.setFocusable(true);
    }
}

// Get current window
function getCurrentWindow(): BrowserWindow | null {
    let win = mainWindow;

    if (!win) {
        return null;
    }

    while (true) {
        const childWindows = win.getChildWindows();

        if (childWindows.length === 0) {
            return win;
        }

        win = childWindows[0];
    }
}

// Create main window
function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 610,
        height: 770,
        useContentSize: true,
        maximizable: false,
        thickFrame: false, // Workaround for https://github.com/electron/electron/issues/31233
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [gamePath]
        }
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'html', 'index.html'));
}

// Create 'Advanced Info' window
function createAdvancedWindow(): void {
    const win = new BrowserWindow({
        parent: mainWindow,
        modal: process.platform !== 'darwin',
        width: 600,
        height: 340,
        useContentSize: true,
        minimizable: false,
        maximizable: false,
        thickFrame: false, // Workaround for https://github.com/electron/electron/issues/31233
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [gamePath]
        }
    });

    win.on('ready-to-show', () => {
        disableWindow(mainWindow);
        win.show();
    });

    win.on('close', () => {
        mainWindow.webContents.send('restore-parent');
        reEnableWindow(mainWindow);
    });

    win.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'advanced.html'));
}

// Create new info/warning/error window
function newInfoWindow(parent?: BrowserWindow): BrowserWindow {
    return new BrowserWindow({
        parent: parent || getCurrentWindow() || undefined,
        modal: process.platform !== 'darwin',
        width: 360,
        height: 155,
        useContentSize: true,
        minimizable: false,
        maximizable: false,
        thickFrame: false, // Workaround for https://github.com/electron/electron/issues/31233
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [gamePath]
        }
    });
}

// Load main process window
function loadMainWindow(): void {
    if (fs.existsSync(path.join(gamePath, 'DOOMEternalx64vk.exe')) && fs.existsSync(injectorPath)) {
        const settings = {
            gamePath: path.resolve(gamePath)
        };

        fs.writeFileSync(configPath, JSON.stringify(settings, null, 4));
        createMainWindow();
    }
    else {
        mainWindow = newInfoWindow();

        mainWindow.on('ready-to-show', () => {
            mainWindow.show();
        });

        mainWindow.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
        mainWindow.setMenu(null);
        mainWindow.loadFile(path.join(__dirname, 'html', 'info.html'));
        errorType = 'tools-error';
    }
}

// Create info window and set attributes
function createInfoWindow(send: string): void {
    const win = newInfoWindow();
    const parentWindow = win.getParentWindow()!;

    win.on('ready-to-show', () => {
        win.show();
        disableWindow(parentWindow);
    });

    win.on('close', () => {
        win.getParentWindow()!.webContents.send('restore-parent');
        reEnableWindow(parentWindow);
    });

    win.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'info.html'));
    errorType = send;
}

// Get backup files to restore/delete
function getBackups(dirPath: string, backups?: string[]): string[] {
    backups = backups || [];

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            backups = getBackups(path.join(dirPath, file), backups);
        }
        else if (file.endsWith('.resources.backup') || file.endsWith('.snd.backup')) {
            backups.push(path.join(dirPath, file));
        }
    }

    return backups;
}

// Launch the mod injector script and send output to xterm
function launchScript(win: BrowserWindow): void {
    if (process.platform !== 'win32') {
        // Give executable permissions to the script
        spawnSync('chmod', ['+x', `'${path.resolve(injectorPath)}'`], {
            cwd: gamePath,
            env: process.env,
            shell: true
        });
    }

    // Spawn injector process
    const injectorProcess = spawn(`'${path.resolve(injectorPath)}'`, [], {
        cwd: gamePath,
        env: process.env,
        shell: true
    });

    // Send output to xterm
    injectorProcess.stdout.on('data', (data: Buffer) => {
        win.webContents.send('terminal-incoming-data', data);
    });

    injectorProcess.stderr.on('data', (data: Buffer) => {
        win.webContents.send('terminal-incoming-data', data);
    });

    // Handle stdin
    let stdinBuffer: string[] = []

    ipcMain.on('terminal-keystroke', (_event, key: string) => {
        if (/^\w+$/.test(key)) {
            stdinBuffer.push(key);
        }
        else {
            switch (key.charCodeAt(0)) {
                case 13:
                    injectorProcess.stdin.write(stdinBuffer + '\n');
                    stdinBuffer = [];
                    break;
                case 127:
                    stdinBuffer = stdinBuffer.length === 0 ? stdinBuffer.slice(0, -1) : [];
                    break;
            }
        }
    });

    // Kill process if window is closed
    win.on('close', () => {
        try {
            injectorProcess.kill('SIGINT');
        }
        catch {}

        win.getParentWindow()!.webContents.send('restore-parent');
    });
}

async function handleBackups(restore: boolean): Promise<void> {
    const backups = getBackups(path.join(gamePath, 'base'));
    const exePath = path.join(gamePath, 'DOOMEternalx64vk.exe.backup');
    const packageMapSpecPath = path.join(gamePath, 'base', 'packagemapspec.json.backup');

    if (fs.existsSync(exePath)) {
        backups.push(exePath);
    }

    if (fs.existsSync(packageMapSpecPath)) {
        backups.push(packageMapSpecPath);
    }

    if (restore) {
        for (const backup of backups) {
            await fsPromises.copyFile(backup, backup.slice(0, -7)).catch(() => {
                createInfoWindow('restore-error');
            });
        }
    }
    else {
        for (const backup of backups) {
            await fsPromises.unlink(backup).catch(() => {
                createInfoWindow('reset-error');
            });
        }
    }
}

// Load main window on app startup
app.whenReady().then(() => {
    // If running through snap, make sure steam-files is connected
    if (process.env['SNAP']) {
        const steamFilesConnected = spawnSync('snapctl', ['is-connected', 'steam-files'], {
            env: process.env,
            shell: true
        }).status === 0;

        if (!steamFilesConnected) {
            mainWindow = newInfoWindow();

            mainWindow.on('ready-to-show', () => {
                mainWindow.show();
            });

            mainWindow.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
            mainWindow.setMenu(null);
            mainWindow.loadFile(path.join(__dirname, 'html', 'info.html'));
            errorType = 'snap-connections-error';

            return;
        }
    }

    // If game path was not specified, try to get it from the config
    if (gamePath.length === 0 && fs.existsSync(configPath)) {
        gamePath = JSON.parse(fs.readFileSync(configPath, 'utf8')).gamePath || '';
    }

    // If game path is still undefined, prompt the user
    if (gamePath.length === 0) {
        try {
            gamePath = dialog.showOpenDialogSync({
                buttonLabel: 'Open',
                title: 'Open the game directory',
                properties: ['openDirectory', 'showHiddenFiles']
            })![0];
        }
        catch {
            gamePath = process.cwd();
        }
    }

    injectorPath = process.platform === 'win32' ? path.join(gamePath, 'EternalModInjector.bat') : path.join(gamePath, 'EternalModInjectorShell.sh');
    loadMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            loadMainWindow();
        }
    });
});

// Close app on exit
app.on('window-all-closed', () => {
    app.quit();
});

// Close current window
ipcMain.on('close-window', () => {
    getCurrentWindow()!.close();
});

// Launch script
ipcMain.on('launch-script', () => {
    // Create terminal window
    const win = new BrowserWindow({
        parent: mainWindow,
        modal: process.platform !== 'darwin',
        width: 1000,
        height: 505,
        useContentSize: true,
        minimizable: false,
        maximizable: false,
        thickFrame: false, // Workaround for https://github.com/electron/electron/issues/31233
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [gamePath]
        }
    });

    win.on('ready-to-show', () => {
        // Launch script
        disableWindow(mainWindow);
        win.show();
        launchScript(win);
    });

    win.on('close', () => {
        reEnableWindow(mainWindow);
    });

    win.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'terminal.html'));
});

// Launch 'Advanced Info' window
ipcMain.on('advanced-window', createAdvancedWindow);

// Launch info window if the settings file is missing
ipcMain.on('settings-info-window', () => {
    const win = newInfoWindow();

    win.on('ready-to-show', () => {
        disableWindow(mainWindow);
        win.show();
    });

    win.on('close', () => {
        reEnableWindow(mainWindow);
    });

    win.on('closed', createAdvancedWindow);
    win.setResizable(false); // Workaround for https://github.com/electron/electron/issues/31233
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'info.html'));
    errorType = 'settings-info';
});

// Launch info window after copying to clipboard
ipcMain.on('clipboard-window', () => {
    createInfoWindow('clipboard-info');
});

// Launch info window before restoring backups
ipcMain.on('restore-window', () => {
    createInfoWindow('restore-info');
});

// Restore backups
ipcMain.on('close-restore-window', () => {
    errorType = 'restoring-info';
    const currentWindow = getCurrentWindow()!;
    currentWindow.webContents.send(errorType);

    // Restore backups
    handleBackups(true).then(() => {
        currentWindow.close();
        createInfoWindow('restore-success-info');
    });
});

// Launch info window before deleting backups
ipcMain.on('reset-window', () => {
    createInfoWindow('reset-info');
});

// Delete backups
ipcMain.on('close-reset-window', () => {
    errorType = 'resetting-info';
    const currentWindow = getCurrentWindow()!;
    currentWindow.webContents.send(errorType);

    // Delete backups
    handleBackups(false).then(() => {
        const settingsPath = path.join(gamePath, 'EternalModInjector Settings.txt');
        const newLine = process.platform === 'win32' ? '\r\n' : '\n';

        // Delete backup entries from config file
        if (fs.existsSync(settingsPath)) {
            const settings: string[] = [];

            for (const line of fs.readFileSync(settingsPath, 'utf-8').split('\n').filter(Boolean)) {
                if (line.startsWith(':')) {
                    settings.push(line);
                }
            }

            fs.writeFileSync(settingsPath, settings.join(newLine));
        }

        currentWindow.close();
        createInfoWindow('reset-success-info');
    });
});

// Launch info window after saving settings file
ipcMain.on('settings-saved-window', () => {
    createInfoWindow('settings-saved-info');
});

// Send info message to info window
ipcMain.on('get-info', () => {
    getCurrentWindow()!.webContents.send(errorType);
});

// Load main window after downloading the modding tools
ipcMain.on('tools-download-complete', () => {
    const win = getCurrentWindow()!;
    loadMainWindow();
    win.close();
});
