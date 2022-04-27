import path from 'path';
import fs from 'fs';
import { ipcRenderer } from 'electron';
import fileWatcher, { FSWatcher } from 'chokidar';
import admZip, { IZipEntry } from 'adm-zip';
import dragDrop from 'drag-drop';

const gamePath = process.argv.slice(-1)[0];
const settingsPath = path.join(gamePath, 'EternalModInjector Settings.txt');
const modsPath = path.join(gamePath, 'Mods');
const disabledModsPath = path.join(gamePath, 'DisabledMods');
let watcher: FSWatcher;

// Class containing mod info
class ModInfo {
    name: string;
    isValid: boolean;
    isOnlineSafe: boolean;
    author: string;
    description: string;
    version: string;
    loadPriority: string;
    requiredVersion: string;

    constructor(name: string | null, isValid: boolean, isOnlineSafe: boolean, author?: string | null,
    description?: string | null, version?: string | null, loadPriority?: number | null, requiredVersion?: number | null) {
        this.name = name || '';
        this.isValid = isValid;
        this.isOnlineSafe = isOnlineSafe;
        this.author = author || 'Unknown.';
        this.description = description || 'Not specified.';
        this.version = version || 'Not specified.';
        this.loadPriority = loadPriority ? loadPriority.toString() : '0';
        this.requiredVersion = requiredVersion ? requiredVersion.toString() : 'Unknown.';
    }
}

// Keywords for online safety check
const onlineSafeModNameKeywords = [
    '/eternalmod/', '.tga', '.png', '.swf', '.bimage', '/advancedscreenviewshake/', '/audiolog/', '/audiologstory/', '/automap/', '/automapplayerprofile/',
    '/automapproperties/', '/automapsoundprofile/', '/env/', '/font/', '/fontfx/', '/fx/', '/gameitem/', '/globalfonttable/', '/gorebehavior/',
    '/gorecontainer/', '/gorewounds/', '/handsbobcycle/', '/highlightlos/', '/highlights/', '/hitconfirmationsoundsinfo/', '/hud/', '/hudelement/',
    '/lightrig/', '/lodgroup/', '/material2/', '/md6def/', '/modelasset/', '/particle/', '/particlestage/', '/renderlayerdefinition/', '/renderparm/',
    '/renderparmmeta/', '/renderprogflag/', '/ribbon2/', '/rumble/', '/soundevent/', '/soundpack/', '/soundrtpc/', '/soundstate/', '/soundswitch/',
    '/speaker/', '/staticimage/', '/swfresources/', '/uianchor/', '/uicolor/', '/weaponreticle/', '/weaponreticleswfinfo/', '/entitydef/light/', '/entitydef/fx',
    '/entitydef/', '/impacteffect/', '/uiweapon/', '/globalinitialwarehouse/', '/globalshell/', '/warehouseitem/', '/warehouseofflinecontainer/', '/tooltip/',
    '/livetile/', '/tutorialevent/', '/maps/game/dlc/', '/maps/game/dlc2/', '/maps/game/hub/', '/maps/game/shell/', '/maps/game/sp/', '/maps/game/tutorials/',
    '/decls/campaign'
];

const unsafeResourceNameKeywords = ['gameresources', 'pvp', 'shell', 'warehouse'];

// Check if mod is online safe
function isOnlineSafe(modPath: string): boolean {
    let isSafe = true;
    let isModifyingUnsafeResource = false;
    const assetsInfoJsons: IZipEntry[] = [];
    const modZip = new admZip(modPath);

    for (const modFile of modZip.getEntries()) {
        // Skip directories
        if (modFile.isDirectory) {
            continue;
        }

        const modFileEntry = modFile.entryName.toLowerCase();
        const containerName = modFileEntry.split('/')[0];
        const modName = modFileEntry.slice(containerName.length + 1);
        const soundContainerPath = path.join(gamePath, 'base', 'sound', 'soundbanks', 'pc', containerName + '.snd');

        // Allow hidden system files that may end up in mods accidentally
        if (modFileEntry.endsWith('desktop.ini') || modFileEntry.endsWith('.ds_store')) {
            continue;
        }

        // Allow sound files
        if (fs.existsSync(soundContainerPath)) {
            continue;
        }

        // Allow streamdb mods
        if (containerName === 'streamdb') {
            continue;
        }

        // Save AssetsInfo JSON files to be handled later
        if (modFileEntry.startsWith('EternalMod/assetsinfo/') && modFileEntry.endsWith('.json')) {
            assetsInfoJsons.push(modFile);
            continue;
        }

        // Check if mod is modifying an online-unsafe resource
        if (unsafeResourceNameKeywords.some((keyword) => containerName.startsWith(keyword))) {
            isModifyingUnsafeResource = true;
        }

        // Files with .lwo extension are unsafe
        if (path.extname(modFileEntry).includes('.lwo')) {
            isSafe = false;
        }

        // Allow modification of anything outside 'generated/decls/'
        if (!modName.startsWith('generated/decls')) {
            continue;
        }

        if (isSafe) {
            isSafe = onlineSafeModNameKeywords.some((keyword) => modName.includes(keyword));
        }
    }

    if (isSafe) {
        return true;
    }
    else if (isModifyingUnsafeResource) {
        return false;
    }

    // Don't allow injecting files into the online-unsafe resources
    for (const assetsInfoEntry of assetsInfoJsons) {
        const resourceName = assetsInfoEntry.entryName.split('/')[0];
        const assetsInfo = JSON.parse(modZip.readAsText(assetsInfoEntry));

        if (assetsInfo['resources'] !== null && unsafeResourceNameKeywords.some((keyword) => resourceName.startsWith(keyword))) {
            return false;
        }
    }

    return true;
}

// Get all zip files in given directory
function getZipsInDirectory(directory: string): string[] {
    const zips: string[] = [];
    let dirContent: string[] = [];

    // Check directory for zip files
    try {
        dirContent = fs.readdirSync(directory);
    }
    catch (err) {
        return zips;
    }

    for (const filePath of dirContent) {
        const fullPath = path.join(directory, filePath);

        if (fs.statSync(fullPath).isFile() && filePath.endsWith('.zip')) {
            zips.push(filePath);
        }
    }
  
    return zips;
}

// Load the given mod's info into the given fragment
function loadModIntoFragment(fragment: DocumentFragment, mod: string[]): void {
    const modFile = mod[0];
    const modPath = path.join(mod[1] === 'mod' ? modsPath : disabledModsPath, modFile);
    let modInfo: ModInfo;
    
    // Read mod info from EternalMod.json
    try {
        const modZip = new admZip(modPath);
        const eternalModJson = modZip.getEntry('EternalMod.json');

        if (eternalModJson) {
            const json = JSON.parse(modZip.readAsText(eternalModJson));
            modInfo = new ModInfo(json.name, true, isOnlineSafe(modPath), json.author, json.description, json.version, json.loadPriority, json.requiredVersion);
        }
        else {
            throw new Error('No EternalMod JSON found.');
        }
    }
    catch (err) {
        if ((err as Error).message === 'Invalid or unsupported zip format. No END header found') {
            modInfo = new ModInfo(modFile, false, false);
        }
        else {
            modInfo = new ModInfo(modFile, true, isOnlineSafe(modPath));
        }
    }

    // Create mod list element
    const modCheckbox = document.createElement('input');
    modCheckbox.type = 'checkbox';
    modCheckbox.className = mod[1];
    modCheckbox.checked = mod[1] === 'mod';

    modCheckbox.addEventListener('change', (event: Event) => {
        let isChecked = true;
        let src = path.join(disabledModsPath, modFile);
        let dest = path.join(modsPath, modFile);

        if (!(event.currentTarget as HTMLInputElement).checked) {
            isChecked = false;
            src = path.join(modsPath, modFile);
            dest = path.join(disabledModsPath, modFile);
        }

        try {
            fs.rename(src, dest, (err) => {
                if (err) {
                    throw err;
                }
            });
        }
        catch (err) {
            (event.currentTarget! as HTMLInputElement).checked = !isChecked;
        }
    });

    // Create mod text
    const modName = document.createElement('div');
    modName.className = 'mod-button-name';
    modName.innerHTML = modFile;

    // Check if not online safe mods should be loaded
    const onlyLoadOnlineSafeMods = fs.existsSync(settingsPath) && fs.readFileSync(settingsPath, 'utf8').includes(':ONLINE_SAFE=1');

    // Create online safety check/warning icon
    const onlineSafeCheck = document.createElement('div');
    onlineSafeCheck.className = 'mod-button-check';

    // Create the mod button
    const modButton = document.createElement('button');
    modButton.className = 'mod-button';
    modButton.appendChild(modCheckbox);
    modButton.appendChild(modName);
    modButton.appendChild(onlineSafeCheck);

    if (!modInfo.isValid) {
        onlineSafeCheck.style.color = 'red';
        onlineSafeCheck.innerHTML = '<strong>✗</strong>';
        onlineSafeCheck.title = 'Invalid .zip file.';
        modName.style.color = 'red';
    }
    else if (modInfo.isOnlineSafe) {
        onlineSafeCheck.style.color = 'green';
        onlineSafeCheck.innerHTML = '<strong>✓</strong>';
        onlineSafeCheck.title = 'This mod is safe for use in public matches.';
    }
    else if (onlyLoadOnlineSafeMods) {
        onlineSafeCheck.style.color = 'orange';
        onlineSafeCheck.innerHTML = '<strong>!&nbsp</strong>';
        onlineSafeCheck.title = 'This mod is not safe for use in public matches. It will not be loaded.';
        modName.style.color = 'gray';
        modCheckbox.disabled = true;
    }
    else {
        onlineSafeCheck.style.color = 'red';
        onlineSafeCheck.innerHTML = '<strong>!&nbsp</strong>';
        onlineSafeCheck.title = 'This mod is not safe for public matches. Public Battlemode matches will be disabled.';
    }

    modButton.addEventListener('click', () => {
        document.getElementById('mod-name')!.innerHTML = modInfo.name;
        document.getElementById('mod-author')!.innerHTML = modInfo.author;
        document.getElementById('mod-description')!.innerHTML = modInfo.description;
        document.getElementById('mod-version')!.innerHTML = modInfo.version;
        document.getElementById('mod-min-version')!.innerHTML = modInfo.requiredVersion;
        document.getElementById('mod-load-priority')!.innerHTML = modInfo.loadPriority;
        const modOnlineSafety = document.getElementById('mod-online-safety')!;
        
        if (!modInfo.isValid) {
            modOnlineSafety.style.color = 'red';
            modOnlineSafety.innerHTML = '<strong>Invalid .zip file.</strong>';
        }
        else if (modInfo.isOnlineSafe) {
            modOnlineSafety.style.color = 'green';
            modOnlineSafety.innerHTML = '<strong>This mod is safe for use in public matches.</strong>';
        }
        else {
            if (onlyLoadOnlineSafeMods) {
                modOnlineSafety.style.color = 'orange';
                modOnlineSafety.innerHTML = '<strong>This mod is not safe for use in public matches. It will not be loaded.</strong>';
            }
            else {
                modOnlineSafety.style.color = 'red';

                if (modCheckbox.checked) {
                    modOnlineSafety.innerHTML = '<strong>This mod is not safe for use in public matches. Public Battlemode matches will be disabled.</strong>';
                }
                else {
                    modOnlineSafety.innerHTML = '<strong>This mod is not safe for use in public matches.</strong>';
                }
            }
        }
    });
    
    // Append mod li to fragment
    const modLi = document.createElement('li');
    modLi.appendChild(modButton);
    fragment.appendChild(modLi);
}

// Get all mods in given directory and add them to the mod list
function getMods(): void {
    const fragment = document.createDocumentFragment();
    const mods: string[][] = [];

    for (const modFile of getZipsInDirectory(modsPath)) {
        mods.push([modFile, 'mod']);
    }

    for (const modFile of getZipsInDirectory(disabledModsPath)) {
        mods.push([modFile, 'disabled-mod']);
    }

    mods.sort((a, b) => {
        return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
    });

    for (const mod of mods) {
        loadModIntoFragment(fragment, mod);
    }

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

    // Watch the game directory
    watcher = fileWatcher.watch(path.join(modsPath, '..'), {
        ignored: /[\/\\]\./,
        persistent: true,
        depth: 1
    });

    let watcherReady = false;
    
    // Get mods and display them when ready
    watcher.on('ready', () => {
        getMods();
        watcherReady = true;
    });
    
    watcher.on('all', (event, filePath) => {
        if (!watcherReady) {
            return;
        }

        if (!filePath.startsWith(modsPath) && !filePath.startsWith(disabledModsPath) && !filePath.startsWith(settingsPath)) {
            return;
        }
        
        // Get new mods
        makeModDirectories();
        getMods();
    });
}

// Add functionality to 'Enable/Disable All' checkbox
function initCheckList(): void {
    // Get mods & checkbox element
    const mods = document.getElementsByClassName('mod');
    const disabledMods = document.getElementsByClassName('disabled-mod');
    const topCheckbox = document.getElementById('top-right-checkbox')!;

    // Make checkbox enable/disable the rest of the checkboxes
    topCheckbox.addEventListener('change', (event) => {
        watcher.unwatch(path.join(modsPath, '..'));

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

        initWatcher();
    });
}

// Add mod drag-n-drop functionality
function initDragAndDrop(): void {
    dragDrop('body', (files: File[]) => {
        for (const file of files) {
            if (!fs.lstatSync(file.path).isFile) {
                continue;
            }

            fs.copyFile(file.path, path.join(modsPath, path.basename(file.path)), () => {
                // No need for error handling, the watcher will take care of it
            });
        }
    });
}

// Init the two main buttons
function initButtons(): void {
    document.getElementById('launch-button')!.addEventListener('click', () => {
        // Set opacity and launch terminal window
        document.body.style.opacity = '0.5'
        ipcRenderer.send('launch-script');
    });

    document.getElementById('advanced-button')!.addEventListener('click', () => {
        // Set opacity and launch advanced window
        document.body.style.opacity = '0.5';
        const send = fs.existsSync(path.join(gamePath, 'EternalModInjector Settings.txt')) ? 'advanced-window' : 'settings-info-window';
        ipcRenderer.send(send);
    });

    ipcRenderer.on('restore-parent', () => {
        // Restore main window
        document.body.style.opacity = '1';
    });
}

// Change HTML title
document.title += ` v${JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')).version} by PowerBall253`;

initWatcher();
initCheckList();
initDragAndDrop();
initButtons();
