import { ipcRenderer } from 'electron';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

let term = new Terminal();
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

term.open(document.getElementById('terminal')!);
fitAddon.fit();

ipcRenderer.on("terminal.incomingData", (event, data) => {
    term.write(data);
});