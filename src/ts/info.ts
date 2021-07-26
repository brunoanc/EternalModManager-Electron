import path from 'path';
import fs from 'fs';
import downloadRelease, { GithubReleaseAsset } from '@terascope/fetch-github-release';
import { ipcRenderer } from 'electron';

const gamePath = process.argv.slice(-1)[0];

// Custom windows styling
if (process.platform === 'win32') {
    document.getElementById('ok-button')!.style.left = '255px';
}

// Set the info window depending on the sent message
ipcRenderer.on('tools-error', () => {
    document.title = 'Error';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/error.svg';

    if (!fs.existsSync(gamePath) || !fs.lstatSync(gamePath).isDirectory) {
        document.getElementById('text')!.innerHTML = 'Can\'t find the game directory.<br>This tool must be launched in the game directory, or have it passed as an argument.';
    }
    else if (!fs.existsSync(path.join(gamePath, 'DOOMEternalx64vk.exe'))) {
        document.getElementById('text')!.innerHTML = 'Can\'t find DOOMEternalx64vk.exe.<br>This tool must be launched in the game directory, or have it passed as an argument.';
    }
    else if (process.platform === 'linux') {
        document.getElementById('text')!.innerHTML = 'Couldn\'t find the modding tools, do you want to download them?';

        const button = document.getElementById('ok-button')!;
        button.innerHTML = 'No';

        const yesButton = document.createElement('button');
        yesButton.innerHTML = 'Yes';
        yesButton.style.position = 'absolute';
        yesButton.style.top = '115px';
        yesButton.style.left = '165px';
        yesButton.id = 'yes-button';

        yesButton.addEventListener('click', () => {
            document.title = 'Information';
            (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
            document.getElementById('text')!.innerHTML = 'Downloading modding tools...';

            const okButton = document.getElementById('ok-button')!;
            document.body.removeChild(okButton);
            document.body.removeChild(document.getElementById('yes-button')!);

            downloadRelease('leveste', 'EternalBasher', gamePath, () => { return true }, (asset: GithubReleaseAsset) => { return asset.name === 'EternalModInjectorShell.zip' }, false, false)
            .then(() => {
                document.getElementById('text')!.innerHTML = 'Modding tools were downloaded succesfully.';
                ipcRenderer.send('tools-download-complete');
            }).catch(() => {
                document.title = 'Error';
                (document.getElementById('error-img') as HTMLImageElement).src = '../assets/error.svg';
                document.getElementById('text')!.innerHTML = 'Failed to download the modding tools.';
                okButton.innerHTML = 'OK';
                document.body.appendChild(okButton);
                document.body.removeChild(document.getElementById('yes-button')!);
            });
        });

        document.body.appendChild(yesButton);
    }
    else {
        document.getElementById('text')!.innerHTML = 'Can\'t find EternalModInjector.bat.<br>Make sure that the modding tools are installed.';
    }
});

ipcRenderer.on('settings-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Mod injector settings file not found.<br>The mod injector settings section will not be available until the mod injector is ran at least once.';
});

ipcRenderer.on('clipboard-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'EternalMod.json template has been copied to your clipboard.';
});

ipcRenderer.on('restore-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'This will restore your game to vanilla state by restoring the unmodded backed up game files.<br>' +
        'This process might take a while depending on the speed of your disk, so please be patient.<br>' +
        'Are you sure you want to continue?';
    
    const button = document.getElementById('ok-button')!;
    button.innerHTML = 'No';

    const yesButton = document.createElement('button');
    yesButton.innerHTML = 'Yes';
    yesButton.style.position = 'absolute';
    yesButton.style.top = '115px';
    yesButton.style.left = '165px';
    yesButton.id = 'yes-button';

    yesButton.addEventListener('click', () => {
        ipcRenderer.send('close-restore-window');
    });

    document.body.appendChild(yesButton);
});

ipcRenderer.on('restoring-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Restoring backups...';
    document.body.removeChild(document.getElementById('ok-button')!);
    document.body.removeChild(document.getElementById('yes-button')!);
});

ipcRenderer.on('restore-error', () => {
    document.title = 'Error';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/error.svg';
    document.getElementById('text')!.innerHTML = 'Error while restoring backup file.';
});

ipcRenderer.on('restore-success-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Finished restoring backups.';
});

ipcRenderer.on('reset-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/warning.svg';
    document.getElementById('text')!.innerHTML = 'This will delete your backed up game files.<br>' +
        'The next time mods are injected the backups will be re-created, so make sure to verify your game files after doing this.<br>' +
        'Are you sure you want to continue?';
    
    const button = document.getElementById('ok-button');
    button!.innerHTML = 'No';

    const yesButton = document.createElement('button');
    yesButton.innerHTML = 'Yes';
    yesButton.style.position = 'absolute';
    yesButton.style.top = '115px';
    yesButton.style.left = '165px';
    yesButton.id = 'yes-button';

    yesButton.addEventListener('click', () => {
        ipcRenderer.send('close-reset-window');
    });

    document.body.appendChild(yesButton);
});

ipcRenderer.on('resetting-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Deleting backups...';
    document.body.removeChild(document.getElementById('ok-button')!);
    document.body.removeChild(document.getElementById('yes-button')!);
});

ipcRenderer.on('reset-error', () => {
    document.title = 'Error';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/error.svg';
    document.getElementById('text')!.innerHTML = 'Error while deleting backup file.';
});

ipcRenderer.on('reset-success-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Finished deleting backups.';
});

ipcRenderer.on('settings-saved-info', () => {
    document.title = 'Information';
    (document.getElementById('error-img') as HTMLImageElement).src = '../assets/info.svg';
    document.getElementById('text')!.innerHTML = 'Successfully saved the new settings.';
});

// Use 'OK' button to close info window
document.getElementById('ok-button')!.addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Ask main process for the info message
ipcRenderer.send('get-info');