import path from 'path';
import fs from 'fs';
import { shell, clipboard, ipcRenderer } from 'electron';

const gamePath = process.argv.slice(-1)[0];

// Disable JSON copy button on flatpak/snap - no clipboard writing support
/*if (process.env['FLATPAK_ID'] || process.env['SNAP']) {
    (document.getElementById('copy-json') as HTMLInputElement).disabled = true;
}*/

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
    clipboard.writeText('{\n\t"name": "",\n\t"author": "",\n\t"description": "",\n\t"version": "",\n\t"loadPriority": 0,\n\t"requiredVersion": 10\n}');

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
const settingsValuesMap: { [key: string]: string } = {
    AUTO_LAUNCH_GAME: 'auto-launch-checkbox',
    RESET_BACKUPS: 'reset-backups-checkbox',
    SLOW: 'slowmode-checkbox',
    COMPRESS_TEXTURES: 'texture-compression-checkbox',
    VERBOSE: 'verbose-checkbox',
    DISABLE_MULTITHREADING: 'multithreading-checkbox',
    ONLINE_SAFE: 'online-checkbox',
    GAME_PARAMETERS: 'args-input'
};

if (process.platform === 'win32' || !fs.existsSync(settingsPath)) {
    (document.getElementById('autoupdate-checkbox')! as HTMLInputElement).disabled = true;
    document.getElementById('autoupdate-label')!.style.color = 'gray';
}
else {
    settingsValuesMap['AUTO_UPDATE'] = 'autoupdate-checkbox';
}

if (!fs.existsSync(settingsPath)) {
    (document.getElementsByClassName('injector-header')[0] as HTMLElement).style.color = 'gray';
    document.getElementById('args-text')!.style.color = 'gray';
    (document.getElementById('args-input')! as HTMLInputElement).disabled = true;
    (document.getElementById('save-button')! as HTMLInputElement).disabled = true;

    Object.values(settingsValuesMap).forEach((checkbox) => {
        if (checkbox === 'args-input') {
            return;
        }

        (document.getElementById(checkbox)! as HTMLInputElement).disabled = true;
        document.getElementById(checkbox.slice(0, -8) + 'label')!.style.color = 'gray';
    });

    throw new Error('Settings not found, stop script execution');
}

fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean).forEach((line: string) => {
    const splitLine = line.split('=');

    if (splitLine.length !== 2) {
        return;
    }

    if (settingsValuesMap.hasOwnProperty(splitLine[0].slice(1))) {
        settingsMap[splitLine[0]] = splitLine[1].trim();
    }
});

Object.keys(settingsValuesMap).forEach((setting) => {
    if (setting === 'GAME_PARAMETERS') {
        (document.getElementById('args-input')! as HTMLInputElement).value = settingsMap[':GAME_PARAMETERS'] || '';
    }
    else {
        (document.getElementById(settingsValuesMap[setting])! as HTMLInputElement).checked = settingsMap[':' + setting] === '1';
    }
});

document.getElementById('save-button')!.addEventListener('click', () => {
    let settingsFile = '';
    let extraSettings = newLine;

    fs.readFileSync(settingsPath, 'utf-8').split(newLine).filter(Boolean).forEach((line: string) => {
        if (line === newLine) {
            return;
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
    
            settingsFile = settingsFile + ':' + settingsKey + '=' + settingsValue + newLine;
            delete settingsValuesMap[settingsKey];
        }
        else if (line.startsWith(':')) {
            settingsFile = settingsFile + line + newLine;
        }
        else {
            extraSettings = extraSettings + line + newLine;
        }
    });

    Object.keys(settingsValuesMap).forEach((setting) => {
        if (setting === 'GAME_PARAMETERS') {
            settingsFile = settingsFile + ':GAME_PARAMETERS=' + (document.getElementById('args-input')! as HTMLInputElement).value.trim() + newLine;
            return;
        }

        if ((document.getElementById(settingsValuesMap[setting])! as HTMLInputElement).checked) {
            settingsFile = settingsFile + ':' + setting + '=1' + newLine;
        }
    });

    settingsFile += extraSettings;
    fs.writeFileSync(settingsPath, settingsFile);

    document.body.style.opacity = '0.5';
    ipcRenderer.send('settings-saved-window');

    ipcRenderer.on('restore-parent', () => {
        document.body.style.opacity = '1';
    });
});