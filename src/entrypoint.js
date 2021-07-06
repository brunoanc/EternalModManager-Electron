const path = require('path')
const { app, ipcMain, shell, BrowserWindow } = require('electron')
const fs = require('fs')

const appPath = process.env['PORTABLE_EXECUTABLE_DIR'] ? process.env['PORTABLE_EXECUTABLE_DIR'] : '.' // Get app's path
const injectorPath = process.platform == 'win32' ? path.join(appPath, 'EternalModInjector.bat') : path.join(appPath, 'EternalModInjectorShell.sh')
var launchInjector = false
var errorType = ''
var mainWindow

// Create main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 610,
        height: process.platform == 'win32' ? 775 : 720,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    
    mainWindow.setMenu(null)
    mainWindow.loadFile(path.join(__dirname, 'html', 'index.html'))
}

// Create 'Advanced Info' window
function createAdvancedWindow() {
    const win = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 600,
        height: process.platform == 'win32' ? 335 : 306,
        minimizable: false,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.on('closed', () => {
        mainWindow.webContents.send('restore-parent')
    })

    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'advanced.html'))
}

// Create new info/warning/error window
function newInfoWindow(parent) {
    return new BrowserWindow({
        parent: parent ? parent : BrowserWindow.getFocusedWindow(),
        modal: true,
        width: 360,
        height: process.platform == 'win32' ? 180 : 150,
        minimizable: false,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
}

// Load main process window
function loadMainWindow() {
    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe')) && fs.existsSync(injectorPath)) {
        createWindow()
    }
    else {
        const win = newInfoWindow()
        win.setMenu(null)
        win.loadFile(path.join(__dirname, 'html', 'info.html'))
        errorType = 'tools-error'
    }
}

// Create info window and set attributes
function createInfoWindow(send) {
    const win = newInfoWindow()

    win.on('close', () => {
        win.getParentWindow().send('restore-parent')
    })

    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'info.html'))
    errorType = send
}

// Get backup files to restore/delete
function getBackups(dirPath, backups) {
    backups = backups ? backups : []

    const files = fs.readdirSync(dirPath)
  
    files.forEach((file) => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            backups = getBackups(path.join(dirPath, file), backups)
        }
        else if (file.endsWith('.resources.backup') || file.endsWith('.snd.backup')) {
            backups.push(path.join(dirPath, file))
        }
    })
  
    return backups
}

// Load main window on app startup
app.whenReady().then(() => {
    loadMainWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) loadMainWindow()
    })
})

// Close app on exit
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit()
})

// Launch script before exiting, if specified
app.on('will-quit', () => {
    if (launchInjector)
        shell.openPath(injectorPath)
})

// Close current window
ipcMain.on('close-window', () => {
    BrowserWindow.getFocusedWindow().close()
})

// Launch script and quit app
ipcMain.on('launch-script', () => {
    launchInjector = true
    app.quit()
})

// Launch 'Advanced Info' window
ipcMain.on('advanced-window', createAdvancedWindow)

// Launch info window if the settings file is missing
ipcMain.on('settings-info-window', () => {
    const win = newInfoWindow()
    win.on('closed', createAdvancedWindow)
    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'info.html'))
    errorType = 'settings-info'
})

// Launch info window after copying to clipboard
ipcMain.on('clipboard-window', () => {
    createInfoWindow('clipboard-info')
})

// Launch info window before restoring backups
ipcMain.on('restore-window', () => {
    createInfoWindow('restore-info')
})

// Restore backups
ipcMain.on('close-restore-window', () => {
    errorType = 'restoring-info'
    BrowserWindow.getFocusedWindow().webContents.send(errorType)

    const backups = getBackups(path.join(appPath, 'base'))

    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe.backup')))
        backups.push(path.join(appPath, 'DOOMEternalx64vk.exe.backup'))

    if (fs.existsSync(path.join(appPath, 'base', 'packagemapspec.json.backup')))
        backups.push(path.join(appPath, 'base', 'packagemapspec.json.backup'))

    backups.forEach((backup) => {
        try {
            fs.copyFileSync(backup, backup.slice(0, -7))
        }
        catch (err) {
            createInfoWindow('restore-error')
        }
    })

    BrowserWindow.getFocusedWindow().close()
    createInfoWindow('restore-success-info')
})

// Launch info window before deleting backups
ipcMain.on('reset-window', () => {
    createInfoWindow('reset-info')
})

// Delete backups
ipcMain.on('close-reset-window', () => {
    errorType = 'resetting-info'
    BrowserWindow.getFocusedWindow().webContents.send(errorType)

    const backups = getBackups(path.join(appPath, 'base'))

    if (fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe.backup')))
        backups.push(path.join(appPath, 'DOOMEternalx64vk.exe.backup'))

    if (fs.existsSync(path.join(appPath, 'base', 'packagemapspec.json.backup')))
        backups.push(path.join(appPath, 'base', 'packagemapspec.json.backup'))

    backups.forEach((backup) => {
        try {
            fs.unlinkSync(backup)
        }
        catch (err) {
            createInfoWindow('reset-error')
        }
    })

    const settingsPath = path.join(appPath, 'EternalModInjector Settings.txt')

    if (fs.existsSync(settingsPath)) {
        var settings = ''

        fs.readFileSync(settingsPath, 'utf-8').split('\n').filter(Boolean).forEach((line) => {
            if (line.startsWith(':'))
                settings = settings + line + '\n'
        })

        fs.writeFileSync(settingsPath, settings)
    }

    BrowserWindow.getFocusedWindow().close()
    createInfoWindow('reset-success-info')
})

// Launch info window after saving settings file
ipcMain.on('settings-saved-window', () => {
    createInfoWindow('settings-saved-info')
})

// Send info message to info window
ipcMain.on('get-info', () => {
    BrowserWindow.getFocusedWindow().webContents.send(errorType)
})