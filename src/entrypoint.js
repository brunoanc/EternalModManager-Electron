const path = require('path')
const { app, ipcMain, shell, BrowserWindow } = require('electron')
const fs = require('fs')

const injectorPath = process.platform == 'win32' ? path.join('.', 'EternalModInjector.bat') : path.join('.', 'EternalModInjectorShell.sh')
var launchInjector = false
var errorType

function createWindow() {
    const win = new BrowserWindow({
        width: 610,
        height: 775,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    
    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'index.html'))
}

function createAdvancedWindow() {
    const mainWindow = BrowserWindow.getFocusedWindow()

    const win = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        width: 600,
        height: 335,
        minimizable: false,
        maximizable: false,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.on('close', () => {
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
        height: 180,
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
    if (fs.existsSync(path.join('.', 'DOOMEternalx64vk.exe')) && fs.existsSync(injectorPath)) {
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
    const mainWindow = BrowserWindow.getFocusedWindow()
    const win = newInfoWindow(mainWindow)

    win.on('close', () => {
        mainWindow.webContents.send('restore-parent')
    })

    win.setMenu(null)
    win.loadFile(path.join(__dirname, 'html', 'info.html'))
    errorType = send
}

function getBackups(backups) {
    backups = backups ? backups : []

    const dirPath = path.join('.', 'base')
    const files = fs.readdirSync(dirPath)
  
    files.forEach((file) => {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            backups = getAllFiles(path.join(dirPath, file), backups)
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

    const backups = getBackups()

    if (fs.existsSync(path.join('.', 'DOOMEternalx64vk.exe.backup')))
        backups.push(path.join('.', 'DOOMEternalx64vk.exe.backup'))

    if (fs.existsSync(path.join('.', 'base', 'packagemapspec.json.backup')))
        backups.push(path.join('.', 'base', 'packagemapspec.json.backup'))

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

    const backups = getBackups()

    if (fs.existsSync(path.join('.', 'DOOMEternalx64vk.exe.backup')))
        backups.push(path.join('.', 'DOOMEternalx64vk.exe.backup'))

    if (fs.existsSync(path.join('.', 'base', 'packagemapspec.json.backup')))
        backups.push(path.join('.', 'base', 'packagemapspec.json.backup'))

    backups.forEach((backup) => {
        try {
            fs.unlinkSync(backup)
        }
        catch (err) {
            createInfoWindow('reset-error')
        }
    })

    const settingsPath = path.join('.', 'EternalModInjector Settings.txt')

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