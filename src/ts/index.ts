import path from 'path';
import fs from 'fs';
import { ipcRenderer } from 'electron';
import fileWatcher from 'chokidar';
import admZip from 'adm-zip';
import dragDrop from 'drag-drop';

const appPath = process.argv.slice(-1)[0];
const modsPath = path.join(appPath, 'Mods');
const disabledModsPath = path.join(appPath, 'DisabledMods');

// Class containing mod info
class ModInfo {
    name: string;
    author: string;
    description: string;
    version: string;
    loadPriority: string;
    requiredVersion: string;

    constructor(name: string | null, author?: string | null, description?: string | null, version?: string | null, loadPriority?: number | null, requiredVersion?: number | null) {
        this.name = name || '';
        this.author = author || 'Unknown.';
        this.description = description || 'Not specified.';
        this.version = version || 'Not specified.';
        this.loadPriority = loadPriority ? loadPriority.toString() : '0';
        this.requiredVersion = requiredVersion ? requiredVersion.toString() : 'Unknown.';
    }
}

// Get all zip files in given directory
function getZipsInDirectory(directory: string): string[] {
    const zips: string[] = [];

    try {
        var dirContent = fs.readdirSync(directory);
    }
    catch (err) {
        return zips;
    }
  
    dirContent.forEach((filePath) => {
        const fullPath = path.join(directory, filePath);

        if (fs.statSync(fullPath).isFile() && filePath.endsWith('.zip')) {
            zips.push(filePath);
        }
    });
  
    return zips;
}

// Get all mods in given directory and add them to the mod list
function getMods(): void {
    const fragment = document.createDocumentFragment();
    const mods: string[][] = [];

    getZipsInDirectory(modsPath).forEach((modFile) => {
        mods.push([ modFile, 'mod' ]);
    });

    getZipsInDirectory(disabledModsPath).forEach((modFile) => {
        mods.push([ modFile, 'disabled-mod' ]);
    });

    mods.sort((a, b) => {
        return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
    });

    mods.forEach((mod) => {
        var modFile = mod[0];
        var modInfo: ModInfo;
        
        try {
            var zip = new admZip(path.join(modsPath, modFile));
            var zipEntry = zip.getEntry('EternalMod.json');

            if (zipEntry) {
                var json = JSON.parse(zip.readAsText(zipEntry));
                modInfo = new ModInfo(json.name, json.author, json.description, json.version, json.loadPriority, json.requiredVersion);
                
            }
            else {
                throw new Error('Error');
            }
        }
        catch (err) {
            modInfo = new ModInfo(modFile);
        }

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = mod[1];
        checkbox.checked = mod[1] === 'mod';

        checkbox.addEventListener('change', (event: Event) => {
            if ((event.currentTarget! as HTMLInputElement).checked) {
                try {
                    fs.rename(path.join(disabledModsPath, modFile), path.join(modsPath, modFile), (err) => {
                        if (err) {
                            throw err;
                        }
                    });
                }
                catch (err) {
                    (event.currentTarget! as HTMLInputElement).checked = false;
                }
            }
            else {
                try {
                    fs.rename(path.join(modsPath, modFile), path.join(disabledModsPath, modFile), (err) => {
                        if (err) {
                            throw err;
                        }
                    });
                }
                catch (err) {
                    (event.currentTarget! as HTMLInputElement).checked = true;
                }
            }
        });

        var button = document.createElement('button');
        button.className = 'mod-button';
        button.appendChild(checkbox);
        button.appendChild(document.createTextNode(modFile));

        button.addEventListener('click', () => {
            document.getElementById('mod-name')!.innerHTML = modInfo.name;
            document.getElementById('mod-author')!.innerHTML = modInfo.author;
            document.getElementById('mod-description')!.innerHTML = modInfo.description;
            document.getElementById('mod-version')!.innerHTML = modInfo.version;
            document.getElementById('mod-min-version')!.innerHTML = modInfo.requiredVersion;
            document.getElementById('mod-load-priority')!.innerHTML = modInfo.loadPriority;
        });
        
        var modLI = document.createElement('li');
        modLI.appendChild(button);
        fragment.appendChild(modLI);
    });

    const modsList = document.getElementById('mods-list')!;

    while (modsList.firstChild)
        modsList.removeChild(modsList.firstChild);

    modsList.appendChild(fragment);
}

// Create the mod directories
function makeModDirectories(): void {
    if (!fs.existsSync(modsPath)) {
        fs.mkdirSync(modsPath);
    }
    
    if (!fs.existsSync(disabledModsPath)) {
        fs.mkdirSync(disabledModsPath);
    }
}

// Init the directory watcher to check for changes in the mod folders
function initWatcher(): void {
    makeModDirectories();

    var watcher = fileWatcher.watch(path.join(modsPath, '..'), {
        ignored: /[\/\\]\./,
        persistent: true,
        depth: 1
    });

    var watcherReady = false;
    
    watcher.on('ready', () => {
        getMods()
        watcherReady = true
    });
    
    watcher.on('all', (event, path) => {
        if ((!path.startsWith(modsPath) && !path.startsWith(disabledModsPath)) || !watcherReady) {
            return;
        }
        
        makeModDirectories();
        getMods();
    });
}

// Add functionality to 'Enable/Disable All' checkbox
function initCheckList(): void {
    const mods = document.getElementsByClassName('mod');
    const disabledMods = document.getElementsByClassName('disabled-mod');
    const topCheckbox = document.getElementById('top-right-checkbox')!;

    topCheckbox.addEventListener('change', (event) => {
        if ((event.currentTarget! as HTMLInputElement).checked) {
            while (disabledMods.length > 0) {
                (disabledMods[0] as HTMLInputElement).checked = true;
                disabledMods[0].dispatchEvent(new Event('change'));
                disabledMods[0].className = 'mod';
            }
        }
        else {
            while (mods.length > 0) {
                (mods[0] as HTMLInputElement).checked = false;
                mods[0].dispatchEvent(new Event('change'));
                mods[0].className = 'disabled-mod';
            }
        }
    });
}

// Add mod drag-n-drop functionality
function initDragAndDrop(): void {
    dragDrop('body', (files: File[]) => {
        files.forEach((file) => {
            if (!fs.lstatSync(file.path).isFile) {
                return;
            }

            fs.copyFile(file.path, path.join(modsPath, path.basename(file.path)), (err) => {});
        });
    });
}

// Init the two main buttons
function initButtons(): void {
    document.getElementById('launch-button')!.addEventListener('click', () => {
        ipcRenderer.send('launch-script');
    });

    document.getElementById('advanced-button')!.addEventListener('click', () => {
        document.body.style.opacity = '0.5';
        const send = fs.existsSync(path.join(appPath, 'EternalModInjector Settings.txt')) ? 'advanced-window' : 'settings-info-window';
        ipcRenderer.send(send);
    });

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
}

// Change HTML title
document.title += ` v${require(path.join(__dirname, '..', '..', 'package.json')).version} by PowerBall253`;

initWatcher();
initCheckList();
initDragAndDrop();
initButtons();