# Deployment Guide: QSOlive Frontend to Hugging Face

This document provides instructions for deploying the latest frontend build to your Hugging Face Space using your local deployment folder.

**Source Directory:** `D:\vijay\MyDocuments\qsolive\frontend`
**Deployment Directory:** `D:\vijay\MyDocuments\qsolive_deploy`

## Quick Script (PowerShell)

Run the following block in PowerShell to build, copy, and push automatically:

```powershell
# 1. Build the frontend
Set-Location "D:\vijay\MyDocuments\qsolive\frontend"
npm run build

# 2. Copy build artifacts to deployment folder
# This copies the contents of 'dist' to the deploy repo root
Copy-Item -Path ".\dist\*" -Destination "D:\vijay\MyDocuments\qsolive_deploy" -Recurse -Force

# 3. Push to Hugging Face
Set-Location "D:\vijay\MyDocuments\qsolive_deploy"
git add .
git commit -m "Update frontend build"
git push

Write-Host "Deployment pushed to Hugging Face!"
```

## Manual Steps

### 1. Build the Application
1. Open a terminal at `D:\vijay\MyDocuments\qsolive\frontend`.
2. Run `npm run build`.
3. Verify that a `dist` folder is created with `index.html` inside.

### 2. Transfer Files
1. Copy all files **inside** `D:\vijay\MyDocuments\qsolive\frontend\dist`.
2. Paste them into `D:\vijay\MyDocuments\qsolive_deploy`, overwriting existing files.
   * *Ensure `index.html` ends up at the root of `qsolive_deploy`.*

### 3. Push to Hugging Face
1. Open a terminal at `D:\vijay\MyDocuments\qsolive_deploy`.
2. Run the following git commands:

```bash
git add .
git commit -m "New deployment"
git push
```

Once pushed, Hugging Face will detect the changes and update the static site (usually within 1-2 minutes).