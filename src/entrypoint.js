const path = require('path')
const { app, ipcMain, shell, BrowserWindow } = require('electron')
const fs = require('fs')

const appPath = process.env['PORTABLE_EXECUTABLE_DIR'] ? process.env['PORTABLE_EXECUTABLE_DIR'] : '.'
const injectorPath = process.platform == 'win32' ? path.join(appPath, 'EternalModInjector.bat') : path.join(appPath, 'EternalModInjectorShell.sh')
var launchInjector = false
var errorType = ''
var mainWindow

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

function createInfoWindow(send) {
    const win = newInfoWindow()

    win.on('close', () => {
        win.getParentWindow().send('restore-parent')
    })

    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'info.html'))
    errorType = send
}

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

app.whenReady().then(() => {
    loadMainWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) loadMainWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', (event) => {
    event.preventDefault()

    if (launchInjector)
        shell.openPath(injectorPath)

    app.exit()
})

ipcMain.on('close-window', () => {
    BrowserWindow.getFocusedWindow().close()
})

ipcMain.on('launch-script', () => {
    launchInjector = true
    app.quit()
})

ipcMain.on('advanced-window', createAdvancedWindow)

ipcMain.on('settings-info-window', () => {
    const win = newInfoWindow()
    win.on('closed', createAdvancedWindow)
    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'info.html'))
    errorType = 'settings-info'
})

ipcMain.on('clipboard-window', () => {
    createInfoWindow('clipboard-info')
})

ipcMain.on('restore-window', () => {
    createInfoWindow('restore-info')
})

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

ipcMain.on('reset-window', () => {
    createInfoWindow('reset-info')
})

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

ipcMain.on('settings-saved-window', () => {
    createInfoWindow('settings-saved-info')
})

ipcMain.on('get-error', () => {
    BrowserWindow.getFocusedWindow().webContents.send(errorType)
})