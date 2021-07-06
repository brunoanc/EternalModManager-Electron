const path = require('path')
const fs = require('fs')
const { ipcRenderer } = require('electron')
const fileWatcher = require('chokidar')
const admZip = require('adm-zip')
const dragDrop = require('drag-drop')

const appPath = process.env['PORTABLE_EXECUTABLE_DIR'] ? process.env['PORTABLE_EXECUTABLE_DIR'] : '.'
const modsPath = path.join(appPath, 'Mods')
const disabledModsPath = path.join(appPath, 'DisabledMods')

class ModInfo {
    constructor(name, author, description, version, loadPriority, requiredVersion) {
        this.name = name ? name : ''
        this.author = author ? author : 'Unknown.'
        this.description = description ? description : 'Not specified.'
        this.version = version ? version : 'Not specified.'
        this.loadPriority = loadPriority ? loadPriority.toString() : '0'
        this.requiredVersion = requiredVersion ? requiredVersion.toString() : 'Unknown.'
    }
}

function getZipsInDirectory(directory) {
    const zips = []

    try {
        var dirContent = fs.readdirSync(directory)
    }
    catch (err) {
        return zips
    }
  
    dirContent.forEach((filePath) => {
        const fullPath = path.join(directory, filePath)

        if (fs.statSync(fullPath).isFile() && filePath.endsWith('.zip'))
            zips.push(filePath)
    })
  
    return zips
}

function getMods() {
    const fragment = document.createDocumentFragment()

    getZipsInDirectory(modsPath).forEach((modFile) => {
        var modInfo
        
        try {
            var zip = new admZip(path.join(modsPath, modFile))
            var zipEntry = zip.getEntry('EternalMod.json')

            if (zipEntry) {
                var json = JSON.parse(zip.readAsText(zipEntry))
                modInfo = new ModInfo(json.name, json.author, json.description, json.version, json.loadPriority, json.requiredVersion)
                
            }
            else {
                throw 'Error'
            }
        }
        catch (err) {
            modInfo = new ModInfo(modFile, undefined, undefined, undefined, undefined, undefined)
        }

        var checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'mod'
        checkbox.checked = true

        checkbox.addEventListener('change', (event) => {
            if (event.currentTarget.checked) {
                try {
                    fs.rename(path.join(disabledModsPath, modFile), path.join(modsPath, modFile), (err) => {
                        if (err)
                            throw err
                    })
                }
                catch (err) {
                    event.currentTarget.checked = false
                }
            }
            else {
                try {
                    fs.rename(path.join(modsPath, modFile), path.join(disabledModsPath, modFile), (err) => {
                        if (err)
                            throw err
                    })
                }
                catch (err) {
                    event.currentTarget.checked = true
                }
            }
        })

        var button = document.createElement('button')
        button.className = 'mod-button'
        button.appendChild(checkbox)
        button.appendChild(document.createTextNode(modFile))

        button.addEventListener('click', () => {
            document.getElementById('mod-name').innerHTML = modInfo.name
            document.getElementById('mod-author').innerHTML = modInfo.author
            document.getElementById('mod-description').innerHTML = modInfo.description
            document.getElementById('mod-version').innerHTML = modInfo.version
            document.getElementById('mod-min-version').innerHTML = modInfo.requiredVersion
            document.getElementById('mod-load-priority').innerHTML = modInfo.loadPriority
        })
        
        var mod = document.createElement('li')
        mod.appendChild(button)
        fragment.appendChild(mod)
    })

    getZipsInDirectory(disabledModsPath).forEach((modFile) => {
        var modInfo
        
        try {
            var zip = new admZip(path.join(disabledModsPath, modFile))
            var zipEntry = zip.getEntry('EternalMod.json')

            if (zipEntry) {
                var json = JSON.parse(zip.readAsText(zipEntry))
                modInfo = new ModInfo(json.name, json.author, json.description, json.version, json.loadPriority, json.requiredVersion)
                
            }
            else {
                throw 'Error'
            }
        }
        catch (err) {
            modInfo = new ModInfo(modFile, null, null, null, null, null)
        }

        var checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.className = 'disabled-mod'
        checkbox.checked = false

        checkbox.addEventListener('change', (event) => {
            if (event.currentTarget.checked) {
                try {
                    fs.rename(path.join(disabledModsPath, modFile), path.join(modsPath, modFile), (err) => {
                        if (err)
                            throw err
                    })
                }
                catch (err) {
                    event.currentTarget.checked = false
                }
            }
            else {
                try {
                    fs.rename(path.join(modsPath, modFile), path.join(disabledModsPath, modFile), (err) => {
                        if (err)
                            throw err
                    })
                }
                catch (err) {
                    event.currentTarget.checked = true
                }
            }
        })

        var button = document.createElement('button')
        button.className = 'mod-button'
        button.appendChild(checkbox)
        button.appendChild(document.createTextNode(modFile))

        button.addEventListener('click', () => {
            document.getElementById('mod-name').innerHTML = modInfo.name
            document.getElementById('mod-author').innerHTML = modInfo.author
            document.getElementById('mod-description').innerHTML = modInfo.description
            document.getElementById('mod-version').innerHTML = modInfo.version
            document.getElementById('mod-min-version').innerHTML = modInfo.requiredVersion
            document.getElementById('mod-load-priority').innerHTML = modInfo.loadPriority
        })

        var mod = document.createElement('li')
        mod.appendChild(button)
        fragment.appendChild(mod)
    })

    const modsList = document.getElementById('mods-list')

    while (modsList.firstChild)
        modsList.removeChild(modsList.firstChild)

    modsList.appendChild(fragment)
}

function makeModDirectories() {
    if (!fs.existsSync(modsPath))
        fs.mkdirSync(modsPath)
    
    if (!fs.existsSync(disabledModsPath))
        fs.mkdirSync(disabledModsPath)
}

function initWatcher() {
    makeModDirectories()

    var watcher = fileWatcher.watch(path.join(modsPath, '..'), {
        ignored: /[\/\\]\./,
        persistent: true,
        depth: 1
    })

    var watcherReady = false
    
    watcher.on('ready', () => {
        getMods()
        watcherReady = true
    })
    
    watcher.on('all', (event, path) => {
        if ((!path.startsWith(modsPath) && !path.startsWith(disabledModsPath)) || !watcherReady)
            return
        
        makeModDirectories()
        getMods()
    })
}

function initCheckList() {
    const mods = document.getElementsByClassName('mod')
    const disabledMods = document.getElementsByClassName('disabled-mod')
    const topCheckbox = document.getElementById('top-right-checkbox')

    topCheckbox.addEventListener('change', (event) => {
        if (event.currentTarget.checked) {
            while (disabledMods.length > 0) {
                disabledMods[0].checked = true
                disabledMods[0].dispatchEvent(new Event('change'))
                disabledMods[0].className = 'mod'
            }
        }
        else {
            while (mods.length > 0) {
                mods[0].checked = false
                mods[0].dispatchEvent(new Event('change'))
                mods[0].className = 'disabled-mod'
            }
        }
    })
}

function initDragAndDrop() {
    dragDrop('body', (files) => {
        files.forEach((file) => {
            if (!file.isFile)
                return

            fs.copyFile(file.path, path.join(modsPath, path.basename(file.path)), (err) => {})
        })
    })
}

function initButtons() {
    document.getElementById('launch-button').addEventListener('click', () => {
        ipcRenderer.send('launch-script')
    })

    document.getElementById('advanced-button').addEventListener('click', () => {
        document.body.style.opacity = '0.5'
        const send = fs.existsSync(path.join(appPath, 'EternalModInjector Settings.txt')) ? 'advanced-window' : 'settings-info-window'
        ipcRenderer.send(send)
    })

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1'
    })
}

document.title += ` v${require(path.join(__dirname, '..', '..', 'package.json')).version} by PowerBall253`

initWatcher()
initCheckList()
initDragAndDrop()
initButtons()