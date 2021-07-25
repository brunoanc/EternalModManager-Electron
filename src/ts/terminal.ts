import { ipcRenderer } from 'electron';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

// Open xterm.js terminal
const term = new Terminal({
    convertEol: true
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

term.open(document.getElementById('terminal')!);
fitAddon.fit();

// Write data to terminal
ipcRenderer.on('terminal-incoming-data', (event, data: string) => {
    term.write(data);
});

// ANSI stdin implementation
let stdinChars = 0;

term.onKey((key) => {
    let realKey = '';

    if (/^\w+$/.test(key.key)) {
        realKey = key.key;
        stdinChars++;
    }
    else {
        switch (key.key.charCodeAt(0)) {
            case 13:
                realKey = '\n';
                stdinChars = 0;
                break;
            case 127:
                if (stdinChars > 0) {
                    realKey = '\b \b';
                    stdinChars--;
                }
    
                break;
        }
    }

    term.write(realKey);
    ipcRenderer.send("terminal-keystroke", key.key);
});