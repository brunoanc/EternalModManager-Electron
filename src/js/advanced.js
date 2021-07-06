const path = require('path')
const fs = require('fs')
const clipboardy = require('clipboardy')
const { shell, ipcRenderer } = require('electron')

const appPath = process.env['PORTABLE_EXECUTABLE_DIR'] ? process.env['PORTABLE_EXECUTABLE_DIR'] : '.'

// Custom linux styling
if (process.platform == 'linux') {
    document.getElementById('vl').style.height = '290px'
    document.getElementsByClassName('right')[0].style.margin = '10px 0 0 0'
    document.getElementsByClassName('left')[0].style.margin = '17px 0 0 15px'
}

// Add functionality to buttons
document.getElementById('open-mods').addEventListener('click', () => {
    shell.openPath(path.join(appPath, 'Mods'))
})

document.getElementById('open-disabled').addEventListener('click', () => {
    shell.openPath(path.join(appPath, 'DisabledMods'))
})

document.getElementById('open-game').addEventListener('click', () => {
    shell.openPath(appPath)
})

document.getElementById('restore-backups').addEventListener('click', () => {
    document.body.style.opacity = '0.5'
    ipcRenderer.send('restore-window')

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1'
    })
})

document.getElementById('reset-backups').addEventListener('click', () => {
    document.body.style.opacity = '0.5'
    ipcRenderer.send('reset-window')

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1'
    })
})

document.getElementById('copy-json').addEventListener('click', () => {
    clipboardy.writeSync('{\n\t"name":"",\n\t"author":"",\n\t"description":"",\n\t"version":"",\n\t"loadPriority":0,\n\t"requiredVersion":8\n}')

    document.body.style.opacity = '0.5'
    ipcRenderer.send('clipboard-window')

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1'
    })
})

// Add functionality to mod injector settings integration
const settingsPath = path.join(appPath, 'EternalModInjector Settings.txt')
const newLine = process.platform == 'win32' ? '\r\n' : '\n'
const settingsMap = {}
const settingsValuesMap = {
    AUTO_LAUNCH_GAME: 'auto-launch-checkbox',
    RESET_BACKUPS: 'reset-backups-checkbox',
    SLOW: 'slowmode-checkbox',
    COMPRESS_TEXTURES: 'texture-compression-checkbox',
    VERBOSE: 'verbose-checkbox',
    DISABLE_MULTITHREADING: 'multithreading-checkbox',
    GAME_PARAMETERS: 'args-input'
}

if (process.platform == 'win32' || !fs.existsSync(settingsPath)) {
    document.getElementById('autoupdate-checkbox').disabled = true
    document.getElementById('autoupdate-label').style.color = 'gray'
}
else {
    settingsValuesMap['AUTO_UPDATE'] = 'autoupdate-checkbox'
}

if (!fs.existsSync(settingsPath)) {
    document.getElementsByClassName('injector-header')[0].style.color = 'gray'
    document.getElementById('args-text').style.color = 'gray'
    document.getElementById('args-input').disabled = true
    document.getElementById('save-button').disabled = true

    Object.values(settingsValuesMap).forEach((checkbox) => {
        if (checkbox == 'args-input')
            return

        document.getElementById(checkbox).disabled = true
        document.getElementById(checkbox.slice(0, -8) + 'label').style.color = 'gray'
    })

    throw new Error('Settings not found, stop script execution')
}

fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean).forEach((line) => {
    const splitLine = line.split('=')

    if (splitLine.length != 2)
            return

    if (settingsValuesMap.hasOwnProperty(splitLine[0].slice(1)))
        settingsMap[splitLine[0]] = splitLine[1].trim()
})

Object.keys(settingsValuesMap).forEach((setting) => {
    if (setting == 'GAME_PARAMETERS') {
        document.getElementById('args-input').value = settingsMap[':GAME_PARAMETERS'] ? settingsMap[':GAME_PARAMETERS'] : ''
        return
    }
    else {
        document.getElementById(settingsValuesMap[setting]).checked = settingsMap[':' + setting] == '1'
    }
})

document.getElementById('save-button').addEventListener('click', () => {
    var settingsFile = ''
    var extraSettings = newLine

    fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean).forEach((line) => {
        if (line == newLine)
            return

        var splitLine = line.split('=')
        const settingsKey = splitLine[0].slice(1)
        var settingsValue = ''

        if (settingsValuesMap.hasOwnProperty(settingsKey)) {
            if (settingsKey == 'GAME_PARAMETERS') {
                settingsValue = document.getElementById('args-input').value.trim()
            }
            else {
                settingsValue = document.getElementById(settingsValuesMap[settingsKey]).checked ? '1' : '0'
            }
    
            settingsFile = settingsFile + ':' + settingsKey + '=' + settingsValue + newLine
            delete settingsValuesMap[settingsKey]
        }
        else if (line.startsWith(':')) {
            settingsFile = settingsFile + line + newLine
        }
        else {
            extraSettings = extraSettings + line + newLine
        }
    })

    Object.keys(settingsValuesMap).forEach((setting) => {
        if (setting == 'GAME_PARAMETERS') {
            settingsFile = settingsFile + ':GAME_PARAMETERS=' + document.getElementById('args-input').value.trim() + newLine
            return
        }

        if (document.getElementById(settingsValuesMap[setting]).checked)
            settingsFile = settingsFile + ':' + setting + '=1' + newLine
    })

    settingsFile += extraSettings
    fs.writeFileSync(settingsPath, settingsFile)

    document.body.style.opacity = '0.5'
    ipcRenderer.send('settings-saved-window')

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1'
    })
})