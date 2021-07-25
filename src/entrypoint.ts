import path from 'path';
import fs from 'fs';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { app, ipcMain, dialog, BrowserWindow } from 'electron';

// Add binaries to path
if (process.env['FLATPAK_ID']) {
    process.env['PATH'] += ':/var/run/host/usr/bin';
}

// Get application path
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
function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 610,
        height: process.platform === 'win32' ? 775 : (process.env['FLATPAK_ID'] ? 746 : 720),
        maximizable: false,
        resizable: false,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ gamePath ]
        }
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'html', 'index.html'));
}

// Create 'Advanced Info' window
function createAdvancedWindow(): void {
    const win = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 600,
        height: process.platform === 'win32' ? 355 : (process.env['FLATPAK_ID'] ? 352 : 326),
        minimizable: false,
        maximizable: false,
        resizable: false,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ gamePath ]
        }
    });

    win.on('ready-to-show', () => {
        win.show();
    });

    win.on('closed', () => {
        mainWindow.webContents.send('restore-parent');
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'advanced.html'));
}

// Create new info/warning/error window
function newInfoWindow(parent?: BrowserWindow): BrowserWindow {
    return new BrowserWindow({
        parent: parent || getCurrentWindow() || undefined,
        modal: true,
        width: 360,
        height: process.platform === 'win32' ? 180 : (process.env['FLATPAK_ID'] ? 176 : 150),
        minimizable: false,
        maximizable: false,
        resizable: false,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ gamePath ]
        }
    });
}

// Load main process window
function loadMainWindow(): void {
    if (fs.existsSync(path.join(gamePath, 'DOOMEternalx64vk.exe')) && fs.existsSync(injectorPath)) {
        if (!fs.existsSync(configPath)) {
            const settings = {
                gamePath: path.resolve(gamePath)
            };

            fs.writeFileSync(configPath, JSON.stringify(settings, null, 4));
        }

        createWindow();
    }
    else {
        mainWindow = newInfoWindow();

        mainWindow.on('ready-to-show', () => {
            mainWindow.show();
        });

        mainWindow.setMenu(null);
        mainWindow.loadFile(path.join(__dirname, 'html', 'info.html'));
        errorType = 'tools-error';
    }
}

// Create info window and set attributes
function createInfoWindow(send: string): void {
    const win = newInfoWindow();

    win.on('ready-to-show', () => {
        win.show();
    });

    win.on('close', () => {
        win.getParentWindow().webContents.send('restore-parent');
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'info.html'));
    errorType = send;
}

// Get backup files to restore/delete
function getBackups(dirPath: string, backups?: string[]): string[] {
    backups = backups || [];

    const files = fs.readdirSync(dirPath);
  
    files.forEach((file) => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            backups = getBackups(path.join(dirPath, file), backups);
        }
        else if (file.endsWith('.resources.backup') || file.endsWith('.snd.backup')) {
            backups!.push(path.join(dirPath, file));
        }
    })
  
    return backups;
}

// Load main window on app startup
app.whenReady().then(() => {
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
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Close current window
ipcMain.on('close-window', () => {
    getCurrentWindow()!.close();
});

// Launch script
ipcMain.on('launch-script', () => {
    // Custom terminal implementation with xterm.js
    const win = new BrowserWindow({
        parent: getCurrentWindow() || undefined,
        modal: true,
        width: 1000,
        height: process.env['FLATPAK_ID'] ? 526 : 500,
        minimizable: false,
        maximizable: false,
        resizable: false,
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [gamePath]
        }
    });

    let injectorProcess: ChildProcessWithoutNullStreams;

    win.on('ready-to-show', () => {
        win.show();

        injectorProcess = spawn(process.platform == 'win32' ? 'cmd.exe' : 'bash', [path.resolve(injectorPath)], {
            cwd: gamePath,
            env: process.env,
            shell: true
        });

        injectorProcess.stdout.on('data', (data: string) => {
            win.webContents.send('terminal-incoming-data', data);
        });

        injectorProcess.stderr.on('data', (data: string) => {
            win.webContents.send('terminal-incoming-data', data);
        });

        let stdinBuffer = ''

        ipcMain.on('terminal-keystroke', (event, key: string) => {
            if (/^\w+$/.test(key)) {
                stdinBuffer += key;
            }
            else {
                switch (key.charCodeAt(0)) {
                    case 13:
                        injectorProcess.stdin.write(stdinBuffer + '\n');
                        stdinBuffer = '';
                        break;
                    case 127:
                        stdinBuffer = stdinBuffer.length === 0 ? stdinBuffer.slice(0, -1) : '';
                        break;
                }
            }
        });
    });

    win.on('close', () => {
        try {
            injectorProcess.kill();
        }
        catch {}

        win.getParentWindow().webContents.send('restore-parent');
    });

    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'html', 'terminal.html'));
});

// Launch 'Advanced Info' window
ipcMain.on('advanced-window', createAdvancedWindow);

// Launch info window if the settings file is missing
ipcMain.on('settings-info-window', () => {
    const win = newInfoWindow();

    win.on('ready-to-show', () => {
        win.show();
    });

    win.on('closed', createAdvancedWindow);
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
    getCurrentWindow()!.webContents.send(errorType);

    const backups = getBackups(path.join(gamePath, 'base'));

    if (fs.existsSync(path.join(gamePath, 'DOOMEternalx64vk.exe.backup'))) {
        backups.push(path.join(gamePath, 'DOOMEternalx64vk.exe.backup'));
    }

    if (fs.existsSync(path.join(gamePath, 'base', 'packagemapspec.json.backup'))) {
        backups.push(path.join(gamePath, 'base', 'packagemapspec.json.backup'));
    }

    backups.forEach((backup) => {
        try {
            fs.copyFileSync(backup, backup.slice(0, -7));
        }
        catch (err) {
            createInfoWindow('restore-error');
        }
    });

    getCurrentWindow()!.close();
    createInfoWindow('restore-success-info');
});

// Launch info window before deleting backups
ipcMain.on('reset-window', () => {
    createInfoWindow('reset-info');
});

// Delete backups
ipcMain.on('close-reset-window', () => {
    errorType = 'resetting-info';
    getCurrentWindow()!.webContents.send(errorType);

    const backups = getBackups(path.join(gamePath, 'base'));

    if (fs.existsSync(path.join(gamePath, 'DOOMEternalx64vk.exe.backup'))) {
        backups.push(path.join(gamePath, 'DOOMEternalx64vk.exe.backup'));
    }

    if (fs.existsSync(path.join(gamePath, 'base', 'packagemapspec.json.backup'))) {
        backups.push(path.join(gamePath, 'base', 'packagemapspec.json.backup'));
    }

    backups.forEach((backup) => {
        try {
            fs.unlinkSync(backup);
        }
        catch (err) {
            createInfoWindow('reset-error');
        }
    });

    const settingsPath = path.join(gamePath, 'EternalModInjector Settings.txt');

    if (fs.existsSync(settingsPath)) {
        let settings = '';

        fs.readFileSync(settingsPath, 'utf-8').split('\n').filter(Boolean).forEach((line) => {
            if (line.startsWith(':')) {
                settings = settings + line + '\n';
            }
        });

        fs.writeFileSync(settingsPath, settings);
    }

    getCurrentWindow()!.close();
    createInfoWindow('reset-success-info');
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
