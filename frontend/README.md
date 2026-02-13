# Frontend (Vite + React) — Setup, Run, Build & Deploy

This document explains how to set up, run and build the Node.js / React app in this repository's `frontend` folder, and how to deploy the built static site to Hugging Face Spaces (static type).

Prerequisites
- Node.js 16+ and npm (or yarn)
- `git`
- (For HF deploy) Python 3 and `huggingface_hub` CLI (`pip install huggingface-hub`)

Local setup
1. Open a terminal in the `frontend` directory.
2. Install dependencies:

```bash
npm install
# or: yarn
```

Run in development mode

```bash
npm run dev
# open the URL shown in the terminal (usually http://localhost:5173)
```

Run tests (if present)

```bash
npm test
# or a project-specific test command
```

Build for production

```bash
npm run build
# Build output will be in `dist/` by default for Vite projects
```

Preview the production build locally

```bash
npm run preview
# or use a simple static server: npx serve dist
```

Deploy to Hugging Face Spaces (Static)

Option A — using the CLI (recommended):

1. Install and login with Hugging Face CLI:

```bash
pip install huggingface-hub
huggingface-cli login
# follow the prompt to paste your HF token
```

2. Create a new Space (static) and clone it locally. Replace `<user>` and `<space-name>`.

```bash
huggingface-cli repo create <user>/<space-name> --type=space --space-type=static
git clone https://huggingface.co/spaces/<user>/<space-name>
cd <space-name>
```

3. Copy the built files into the Space repo and push:

```bash
cd ../frontend
npm run build
cp -r dist/* ../<space-name>/
cd ../<space-name>
git add .
git commit -m "Deploy frontend build"
git push
```

Notes:
- The repository root of a static Space must contain an `index.html` (so copying the contents of `dist` to the repo root is sufficient).
- If the Space UI asks for a hardware/runtime choice, choose the smallest option for a static site.

Option B — create the Space in the Hugging Face web UI:

- Go to https://huggingface.co/spaces and create a new Space; choose `Static` as the Space type.
- Follow the UI instructions for pushing via Git (the repo URL will be shown). Clone it and copy the `dist/` content into the repo root, commit and push.

Troubleshooting
- If you see a blank page after deployment, check the browser console for 404s — ensure all files from `dist` are present at the repo root.
- If using a custom base path in Vite, set `base` in `vite.config.js` to `/` (or the correct path) before building.

Want me to run these locally and push the build? I can run the build here and prepare the HF repo if you provide your HF username or token and confirm you want me to push.
