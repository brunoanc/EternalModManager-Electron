import path from 'path';
import fs from 'fs';
import { shell, clipboard, ipcRenderer } from 'electron';

const gamePath = process.argv.slice(-1)[0];

// Custom windows styling
if (process.platform === 'win32') {
    (document.getElementsByClassName('right')[0] as HTMLElement).style.margin = 'initial';
    (document.getElementsByClassName('left')[0] as HTMLElement).style.margin = '13px 0 0 15px';
}

// Add functionality to buttons
document.getElementById('open-mods')!.addEventListener('click', () => {
    shell.openPath(path.join(gamePath, 'Mods'));
});

document.getElementById('open-disabled')!.addEventListener('click', () => {
    shell.openPath(path.join(gamePath, 'DisabledMods'));
});

document.getElementById('open-game')!.addEventListener('click', () => {
    shell.openPath(gamePath);
});

document.getElementById('restore-backups')!.addEventListener('click', () => {
    document.body.style.opacity = '0.5';
    ipcRenderer.send('restore-window');

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
});

document.getElementById('reset-backups')!.addEventListener('click', () => {
    document.body.style.opacity = '0.5';
    ipcRenderer.send('reset-window');

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
});

document.getElementById('copy-json')!.addEventListener('click', () => {
    clipboard.writeText('{\n\t"name": "",\n\t"author": "",\n\t"description": "",\n\t"version": "",\n\t"loadPriority": 0,\n\t"requiredVersion": 14\n}');

    document.body.style.opacity = '0.5';
    ipcRenderer.send('clipboard-window');

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
});

// Add functionality to mod injector settings integration
const settingsPath = path.join(gamePath, 'EternalModInjector Settings.txt');
const newLine = process.platform === 'win32' ? '\r\n' : '\n';
const settingsMap: { [key: string]: string } = {};
let settingsValuesMap: { [key: string]: string } = {
    AUTO_LAUNCH_GAME: 'auto-launch-checkbox',
    RESET_BACKUPS: 'reset-backups-checkbox',
    SLOW: 'slowmode-checkbox',
    COMPRESS_TEXTURES: 'texture-compression-checkbox',
    VERBOSE: 'verbose-checkbox',
    DISABLE_MULTITHREADING: 'multithreading-checkbox',
    ONLINE_SAFE: 'online-checkbox',
    GAME_PARAMETERS: 'args-input'
};

// Enable auto update editing on Linux
if (process.platform === 'win32' || !fs.existsSync(settingsPath)) {
    (document.getElementById('autoupdate-checkbox')! as HTMLInputElement).disabled = true;
    document.getElementById('autoupdate-label')!.style.color = 'gray';
}
else {
    settingsValuesMap['AUTO_UPDATE'] = 'autoupdate-checkbox';
}

// Disable settings modification if the file doesn't exist
if (!fs.existsSync(settingsPath)) {
    (document.getElementsByClassName('injector-header')[0] as HTMLElement).style.color = 'gray';
    document.getElementById('args-text')!.style.color = 'gray';
    (document.getElementById('args-input')! as HTMLInputElement).disabled = true;
    (document.getElementById('save-button')! as HTMLInputElement).disabled = true;

    for (const checkbox of Object.values(settingsValuesMap)) {
        if (checkbox === 'args-input') {
            continue;
        }

        (document.getElementById(checkbox)! as HTMLInputElement).disabled = true;
        document.getElementById(checkbox.slice(0, -8) + 'label')!.style.color = 'gray';
    }

    throw new Error('Settings not found, stop script execution');
}

// Read settings file
for (const line of fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean)) {
    const splitLine = line.split('=');

    if (splitLine.length !== 2) {
        continue;
    }

    if (settingsValuesMap.hasOwnProperty(splitLine[0].slice(1))) {
        settingsMap[splitLine[0]] = splitLine[1].trim();
    }
}

// Check the needed settings checkboxes
for (const setting of Object.keys(settingsValuesMap)) {
    if (setting === 'GAME_PARAMETERS') {
        (document.getElementById('args-input')! as HTMLInputElement).value = settingsMap[':GAME_PARAMETERS'] || '';
    }
    else {

        (document.getElementById(settingsValuesMap[setting])! as HTMLInputElement).checked = settingsMap[`:${setting}`] === '1';
    }
}

// Save settings when the button is pressed
document.getElementById('save-button')!.addEventListener('click', () => {
    let settingsFile: string[] = [];
    let extraSettings: string[] = [newLine];

    // Replace already existing settings
    for (const line of fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean)) {
        if (line === newLine) {
            continue;
        }

        let splitLine = line.split('=');
        const settingsKey = splitLine[0].slice(1);
        let settingsValue = '';

        if (settingsValuesMap.hasOwnProperty(settingsKey)) {
            if (settingsKey === 'GAME_PARAMETERS') {
                settingsValue = (document.getElementById('args-input')! as HTMLInputElement).value.trim();
            }
            else {
                settingsValue = (document.getElementById(settingsValuesMap[settingsKey])! as HTMLInputElement).checked ? '1' : '0';
            }
    
            settingsFile.push(`:${settingsKey}=${settingsValue}`);
            delete settingsValuesMap[settingsKey];
        }
        else if (line.startsWith(':')) {
            settingsFile.push(line);
        }
        else {
            extraSettings.push(line);
        }
    }

    // Add unexisting settings
    for (const setting of Object.keys(settingsValuesMap)) {
        if (setting === 'GAME_PARAMETERS') {
            settingsFile.push(`:GAME_PARAMETERS=${(document.getElementById('args-input')! as HTMLInputElement).value.trim()}`);
            continue;
        }

        if ((document.getElementById(settingsValuesMap[setting])! as HTMLInputElement).checked) {
            settingsFile.push(`:${setting}=1`);
        }
    }

    // Write settings file
    fs.writeFileSync(settingsPath, settingsFile.concat(extraSettings).join(newLine));

    // Re-populate settings values map
    settingsValuesMap = {
        AUTO_LAUNCH_GAME: 'auto-launch-checkbox',
        RESET_BACKUPS: 'reset-backups-checkbox',
        SLOW: 'slowmode-checkbox',
        COMPRESS_TEXTURES: 'texture-compression-checkbox',
        VERBOSE: 'verbose-checkbox',
        DISABLE_MULTITHREADING: 'multithreading-checkbox',
        ONLINE_SAFE: 'online-checkbox',
        GAME_PARAMETERS: 'args-input'
    };

    // Launch success window
    document.body.style.opacity = '0.5';
    ipcRenderer.send('settings-saved-window');

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
});