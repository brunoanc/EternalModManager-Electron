# DEPRECATED
Use <https://github.com/PowerBall253/EternalModManager-Avalonia> instead.

# EternalModManager
[![Build](https://github.com/PowerBall253/EternalModManager/actions/workflows/build.yml/badge.svg)](https://github.com/PowerBall253/EternalModManager/actions/workflows/build.yml)

Cross-platform mod manager for DOOM Eternal, built with Electron.

## Installing
### Flatpak (Linux only)
The app is currently available in [Flathub](https://flathub.org/apps/details/com.powerball253.eternalmodmanager). To install it, make sure you have `flatpak` installed, then run
```
flatpak install flathub com.powerball253.eternalmodmanager
```
and reboot your system. The app should now be available in your DE's menu, or you can run it in your terminal with the following command:
```
flatpak run com.powerball253.eternalmodmanager
```

### Snap (Linux only)
The app is currently available in the [Snap Store](https://snapcraft.io/eternalmodmanager). To install it, make sure you have `snap` installed, then run
```
snap install eternalmodmanager
```
and reboot your system. The app should now be available in your DE's menu, or you can run it in your terminal with either of the following commands:
```
eternalmodmanager
snap run eternalmodmanager
```

### AUR (Arch Linux only)
The app is currently available in the [AUR](https://aur.archlinux.org/packages/eternalmodmanager/). You can use your favorite AUR helper to install it, or download and build manually as described in the [Arch wiki](https://aur.archlinux.org/packages/eternalmodmanager/).

### DMG (macOS only)
Download the latest .dmg file from the release section, then open it, and drag the EternalModManager app to the Applications folder.

### Portable executable (Windows and Linux)
Download the latest .exe (on Windows) or AppImage (on Linux) file from the release section to your DOOM Eternal directory.

## Running
First, make sure you have the latest LTS version of NodeJS and `npm` installed. Then clone the repo, and run the following commands:

```
npm ci
npm start
```

## Compiling
First, make sure you have the latest LTS version of NodeJS and `npm` installed. Then clone the repo, and run the following commands:

```
npm ci
npm run build
```

The compiled standalone/AppImage binary will be located in the `dist` folder.
