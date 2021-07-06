const path = require('path')
const fs = require('fs')
const { ipcRenderer } = require('electron')

const appPath = process.env['PORTABLE_EXECUTABLE_DIR'] ? process.env['PORTABLE_EXECUTABLE_DIR'] : '.'

if (process.platform == 'linux')
    document.getElementById('ok-button').style.left = '265px'

ipcRenderer.on('tools-error', () => {
    document.title = 'Error'
    document.getElementById('error-img').src = '../assets/error.svg'

    if (!fs.existsSync(path.join(appPath, 'DOOMEternalx64vk.exe'))) {
        document.getElementById('text').innerHTML = 'Can\'t find DOOMEternalx64vk.exe.<br>This tool needs to be placed in the game folder.'
    }
    else {
        document.getElementById('text').innerHTML = 'Can\'t find ' + (process.platform == 'win32' ? 'EternalModInjector.bat.' : 'EternalModInjectorShell.sh.') + '<br>Make sure that the modding tools are installed.'
    }
})

ipcRenderer.on('settings-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Mod injector settings file not found.<br>The mod injector settings section will not be available until the mod injector is ran at least once.'
})

ipcRenderer.on('clipboard-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'EternalMod.json template has been copied to your clipboard.'
})

ipcRenderer.on('restore-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'This will restore your game to vanilla state by restoring the unmodded backed up game files.<br>' +
        'This process might take a while depending on the speed of your disk, so please be patient.<br>' +
        'Are you sure you want to continue?'
    
    const button = document.getElementById('ok-button')
    button.innerHTML = 'No'

    const yesButton = document.createElement('button')
    yesButton.innerHTML = 'Yes'
    yesButton.style.position = 'absolute'
    yesButton.style.top = '115px'
    yesButton.style.left = '165px'
    yesButton.id = 'yes-button'

    yesButton.addEventListener('click', () => {
        ipcRenderer.send('close-restore-window')
    })

    document.body.appendChild(yesButton)
})

ipcRenderer.on('restoring-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Restoring backups...'
    document.body.removeChild(document.getElementById('ok-button'))
    document.body.removeChild(document.getElementById('yes-button'))
})

ipcRenderer.on('restore-error', () => {
    document.title = 'Error'
    document.getElementById('error-img').src = '../assets/error.svg'
    document.getElementById('text').innerHTML = 'Error while restoring backup file.'
})

ipcRenderer.on('restore-success-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Finished restoring backups.'
})

ipcRenderer.on('reset-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/warning.svg'
    document.getElementById('text').innerHTML = 'This will delete your backed up game files.<br>' +
        'The next time mods are injected the backups will be re-created, so make sure to verify your game files after doing this.<br>' +
        'Are you sure you want to continue?'
    
    const button = document.getElementById('ok-button')
    button.innerHTML = 'No'

    const yesButton = document.createElement('button')
    yesButton.innerHTML = 'Yes'
    yesButton.style.position = 'absolute'
    yesButton.style.top = '115px'
    yesButton.style.left = '165px'
    yesButton.id = 'yes-button'

    yesButton.addEventListener('click', () => {
        ipcRenderer.send('close-reset-window')
    })

    document.body.appendChild(yesButton)
})

ipcRenderer.on('resetting-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Deleting backups...'
    document.body.removeChild(document.getElementById('ok-button'))
    document.body.removeChild(document.getElementById('yes-button'))
})

ipcRenderer.on('reset-error', () => {
    document.title = 'Error'
    document.getElementById('error-img').src = '../assets/error.svg'
    document.getElementById('text').innerHTML = 'Error while deleting backup file.'
})

ipcRenderer.on('reset-success-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Finished deleting backups.'
})

ipcRenderer.on('settings-saved-info', () => {
    document.title = 'Information'
    document.getElementById('error-img').src = '../assets/info.svg'
    document.getElementById('text').innerHTML = 'Successfully saved the new settings.'
})

document.getElementById('ok-button').addEventListener('click', () => {
    ipcRenderer.send('close-window')
})

ipcRenderer.send('get-error')