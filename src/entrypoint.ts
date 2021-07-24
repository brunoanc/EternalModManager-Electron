import path from 'path';
import fs from 'fs';
import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import { spawn } from 'child_process';

// Get application path
let appPath: string = process.env['PORTABLE_EXECUTABLE_DIR'] || '';
let argPath = ''

if (process.argv[0].endsWith('electron') || process.argv[0].endsWith('electron.exe')) {
    argPath = process.argv[2] || '';
}
else {
    argPath = process.argv[1] || '';
}

if (argPath === '--no-sandbox') {
    argPath = '';
}

if (argPath.length > 0) {
    appPath = path.isAbsolute(argPath) ? argPath : path.join(appPath, argPath);
}

const injectorPath = process.platform === 'win32' ? path.join(appPath, 'EternalModInjector.bat') : path.join(appPath, 'EternalModInjectorShell.sh');
let launchInjector = false;
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
        height: process.platform === 'win32' ? 775 : 720,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ appPath ]
        }
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
        height: process.platform === 'win32' ? 355 : 326,
        minimizable: false,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ appPath ]
        }
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
        height: process.platform === 'win32' ? 180 : 150,
        minimizable: false,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [ appPath ]
        }
    });
}

// Load main process window
function loadMainWindow(): void {
    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe')) && fs.existsSync(injectorPath)) {
        createWindow();
    }
    else {
        mainWindow = newInfoWindow();
        mainWindow.setMenu(null);
        mainWindow.loadFile(path.join(__dirname, 'html', 'info.html'));
        errorType = 'tools-error';
    }
}

// Create info window and set attributes
function createInfoWindow(send: string): void {
    const win = newInfoWindow();

    win.on('close', () => {
        win.getParentWindow().webContents.send('restore-parent');
    })

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
    if (appPath.length === 0) {
        try {
            appPath = dialog.showOpenDialogSync({
                buttonLabel: 'Open',
                title: 'Open the game directory',
                properties: ['openDirectory', 'showHiddenFiles']
            })![0];
        }
        catch {
            appPath = process.cwd();
        }
    }

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

// Launch script before exiting, if specified
app.on('will-quit', () => {
    if (launchInjector) {
        let command = '';
        let args: string[];

        if (process.platform === 'win32') {
            command = 'start';
            args = [ 'cmd.exe', '/c', path.resolve(injectorPath) ];
        }
        else {
            command = 'bash';
            args = [ path.resolve(injectorPath) ];
        }

        spawn(command, args, {
            cwd: process.cwd(),
            detached: true,
            shell: true,
            stdio: "inherit"
        });
    }
});

// Close current window
ipcMain.on('close-window', () => {
    getCurrentWindow()!.close();
});

// Launch script and quit app
ipcMain.on('launch-script', () => {
    launchInjector = true;
    app.quit();
});

// Launch 'Advanced Info' window
ipcMain.on('advanced-window', createAdvancedWindow);

// Launch info window if the settings file is missing
ipcMain.on('settings-info-window', () => {
    const win = newInfoWindow();
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

    const backups = getBackups(path.join(appPath, 'base'));

    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe.backup'))) {
        backups.push(path.join(appPath, 'DOOMEternalx64vk.exe.backup'));
    }

    if (fs.existsSync(path.join(appPath, 'base', 'packagemapspec.json.backup'))) {
        backups.push(path.join(appPath, 'base', 'packagemapspec.json.backup'));
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

    const backups = getBackups(path.join(appPath, 'base'));

    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe.backup'))) {
        backups.push(path.join(appPath, 'DOOMEternalx64vk.exe.backup'));
    }

    if (fs.existsSync(path.join(appPath, 'base', 'packagemapspec.json.backup'))) {
        backups.push(path.join(appPath, 'base', 'packagemapspec.json.backup'));
    }

    backups.forEach((backup) => {
        try {
            fs.unlinkSync(backup);
        }
        catch (err) {
            createInfoWindow('reset-error');
        }
    });

    const settingsPath = path.join(appPath, 'EternalModInjector Settings.txt');

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
})

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
