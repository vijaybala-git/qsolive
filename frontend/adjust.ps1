# 1. Go to the frontend directory
Set-Location "d:\vijay\MyDocuments\qsolive\frontend"

# 2. Create the required folder structure
New-Item -ItemType Directory -Force -Path "src\components"
New-Item -ItemType Directory -Force -Path "src\lib"

# 3. Move the files into the correct folders
Move-Item -Path "main.jsx" -Destination "src\main.jsx" -ErrorAction SilentlyContinue
Move-Item -Path "App.jsx" -Destination "src\App.jsx" -ErrorAction SilentlyContinue
Move-Item -Path "index.css" -Destination "src\index.css" -ErrorAction SilentlyContinue
Move-Item -Path "Map.jsx" -Destination "src\components\Map.jsx" -ErrorAction SilentlyContinue
Move-Item -Path "supabase.js" -Destination "src\lib\supabase.js" -ErrorAction SilentlyContinue

Write-Host "File structure fixed! You can now run 'npm run dev' again." -ForegroundColor Green