# Snake3DGame

3D “Snake / Python racing” game built with React + TypeScript + Vite + Three.js.

## Run

```bash
npm install
npm run dev
```

## Controls

- **Steer**: A/D or ←/→
- **Speed**: W/S or ↑/↓
- **Pause**: Space
- **Camera**: C
- **Restart**: R (when paused or game over)

On touch devices the UI shows an on-screen joystick + buttons.

## Tech

- React + TypeScript + Vite
- Three.js (WebGL)

## Build

```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)

This repo is set up to deploy to GitHub Pages via GitHub Actions on every push to `main`.

1. In the GitHub repo settings: **Settings → Pages**
2. Set **Build and deployment → Source** to **GitHub Actions**
3. Push to `main` (or run the workflow manually)

Your site will be available at:

- `https://alexandr-paleev.github.io/Snake3DGame/`
