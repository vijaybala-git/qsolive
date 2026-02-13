# VS Code Development Setup

This guide will help you set up your development environment using Visual Studio Code (VS Code) for QSOlive development.

## Prerequisites

Download and install the following:

1. **VS Code**: https://code.visualstudio.com/
2. **Node.js 18+**: https://nodejs.org/ (includes npm)
3. **Python 3.9+**: https://www.python.org/downloads/
4. **Git**: https://git-scm.com/downloads

### Verify Installations

Open a terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
# Check Node.js
node --version  # Should show v18.x or higher

# Check npm
npm --version   # Should show 9.x or higher

# Check Python
python --version  # Should show 3.9.x or higher
# On some systems, use: python3 --version

# Check Git
git --version   # Should show git version 2.x
```

## Step 1: Install VS Code Extensions

Open VS Code and install these essential extensions:

### Core Extensions

1. **Python** (Microsoft)
   - Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac)
   - Search: "Python"
   - Install the one by Microsoft

2. **ESLint** (for JavaScript/React)
   - Search: "ESLint"
   - Install by Microsoft

3. **Prettier - Code formatter**
   - Search: "Prettier"
   - Install by Prettier

4. **GitLens**
   - Search: "GitLens"
   - Enhanced Git capabilities

### Recommended Extensions

5. **ES7+ React/Redux/React-Native snippets**
   - For React development
   
6. **Auto Rename Tag**
   - Automatically rename paired HTML/JSX tags

7. **Path Intellisense**
   - Autocomplete filenames

8. **Error Lens**
   - Show errors inline

9. **Thunder Client** (or REST Client)
   - Test APIs directly in VS Code

10. **Better Comments**
    - Highlight TODO, FIXME, etc.

### Optional but Useful

- **Tailwind CSS IntelliSense** (if using Tailwind)
- **Database Client** (for viewing Supabase data)
- **Docker** (if using Docker for local development)

## Step 2: Clone the Repository

```bash
# Create a projects directory (if you don't have one)
mkdir ~/projects
cd ~/projects

# Clone QSOlive
git clone https://github.com/yourusername/qsolive.git
cd qsolive

# Open in VS Code
code .
```

## Step 3: Configure VS Code Workspace

### Create Workspace Settings

Create `.vscode/settings.json` in your project root:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  },
  
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/node_modules": true,
    "**/.git": false
  },
  
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.venv": true
  },
  
  "files.associations": {
    "*.sql": "sql"
  },
  
  "terminal.integrated.defaultProfile.windows": "Command Prompt"
}
```

### Create Recommended Extensions File

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "eamodio.gitlens",
    "dsznajder.es7-react-js-snippets",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "usernamehw.errorlens",
    "rangav.vscode-thunder-client"
  ]
}
```

### Create Tasks Configuration

Create `.vscode/tasks.json` for common tasks:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Frontend Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/frontend"
      },
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Run Python Client",
      "type": "shell",
      "command": "python qsolive_client.py",
      "options": {
        "cwd": "${workspaceFolder}/client"
      },
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Install Frontend Dependencies",
      "type": "shell",
      "command": "npm install",
      "options": {
        "cwd": "${workspaceFolder}/frontend"
      },
      "problemMatcher": []
    },
    {
      "label": "Install Client Dependencies",
      "type": "shell",
      "command": "pip install -r requirements.txt",
      "options": {
        "cwd": "${workspaceFolder}/client"
      },
      "problemMatcher": []
    }
  ]
}
```

### Create Launch Configuration (Debugging)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Client",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/client/qsolive_client.py",
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/client"
    },
    {
      "name": "Python: Debug Client",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/client/qsolive_client.py",
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/client",
      "args": ["--debug"],
      "justMyCode": false
    }
  ]
}
```

## Step 4: Setup Python Environment

### Create Virtual Environment

```bash
# Navigate to client directory
cd client

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install development tools
pip install black flake8 pytest
```

### Configure VS Code to Use Virtual Environment

1. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac)
2. Type "Python: Select Interpreter"
3. Choose the interpreter from `.venv`

## Step 5: Setup Frontend Environment

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Install development tools (optional)
npm install -D @types/node @types/react @types/react-dom
```

## Step 6: Configure Environment Variables

### Frontend Environment

Create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Never commit `.env.local` to Git!

### Client Configuration

Create `client/config.json`:

```json
{
  "supabase_url": "https://your-project.supabase.co",
  "supabase_key": "your-service-role-key-here",
  "udp_port": 2237,
  "udp_host": "0.0.0.0",
  "operator_callsign": "W1ABC",
  "update_interval": 1,
  "retry_attempts": 3,
  "retry_delay": 5,
  "log_level": "INFO"
}
```

**Important**: Never commit `config.json` to Git!

### Add to .gitignore

Create `.gitignore` in project root:

```
# Environment files
.env
.env.local
.env.*.local
client/config.json

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
*.so
.pytest_cache/

# Node
node_modules/
dist/
.cache/
*.log

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build artifacts
build/
*.egg-info/
```

## Step 7: Verify Setup

### Test Frontend

```bash
cd frontend
npm run dev
```

Should open browser at `http://localhost:5173` (or similar)

### Test Client

```bash
cd client
python qsolive_client.py
```

Should output: "QSOlive client started, listening on UDP port 2237..."

## Common VS Code Shortcuts

### General
- `Ctrl+Shift+P` / `Cmd+Shift+P`: Command Palette
- `Ctrl+P` / `Cmd+P`: Quick Open (files)
- `Ctrl+Shift+F` / `Cmd+Shift+F`: Search in files
- `Ctrl+` ` / `Cmd+` `: Toggle terminal

### Editing
- `Alt+Up/Down`: Move line up/down
- `Shift+Alt+Up/Down`: Copy line up/down
- `Ctrl+/` / `Cmd+/`: Toggle comment
- `Ctrl+D` / `Cmd+D`: Select next occurrence
- `F2`: Rename symbol

### Navigation
- `Ctrl+Click`: Go to definition
- `Alt+Left/Right`: Navigate back/forward
- `Ctrl+Shift+O` / `Cmd+Shift+O`: Go to symbol in file
- `Ctrl+T` / `Cmd+T`: Go to symbol in workspace

### Debugging
- `F5`: Start debugging
- `F9`: Toggle breakpoint
- `F10`: Step over
- `F11`: Step into
- `Shift+F11`: Step out

## Recommended Workflow

### Starting Development Session

1. **Open VS Code**
   ```bash
   cd ~/projects/qsolive
   code .
   ```

2. **Open Terminal (split view)**
   - Terminal 1: Frontend
   - Terminal 2: Client

3. **Activate Python environment** (Terminal 2)
   ```bash
   cd client
   .venv\Scripts\activate  # Windows
   # or: source .venv/bin/activate  # Mac/Linux
   ```

4. **Start development servers**
   
   Terminal 1 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```
   
   Terminal 2 (Client):
   ```bash
   cd client
   python qsolive_client.py
   ```

### Making Changes

1. **Edit code** in VS Code
2. **Save** (Ctrl+S) - auto-formatting will trigger
3. **Check terminal** for any errors
4. **Refresh browser** (frontend auto-reloads with Vite)
5. **Test client** by sending test UDP packets

### Committing Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: real-time filtering"

# Push to GitHub
git push origin main
```

## Troubleshooting

### Python Import Errors

**Problem**: `ModuleNotFoundError`

**Solution**:
```bash
# Ensure virtual environment is activated
# Install missing package
pip install package-name

# Update requirements.txt
pip freeze > requirements.txt
```

### ESLint/Prettier Conflicts

**Problem**: Formatting keeps changing back

**Solution**: Install both extensions and add to `settings.json`:
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.format.enable": false
}
```

### Node Modules Issues

**Problem**: Weird npm errors

**Solution**:
```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Port Already in Use

**Problem**: "Port 5173 already in use"

**Solution**:
```bash
# Find and kill process
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :5173
kill -9 <PID>
```

## Advanced: Multi-root Workspace

If you want separate frontend and client workspaces:

Create `qsolive.code-workspace`:

```json
{
  "folders": [
    {
      "name": "Frontend",
      "path": "frontend"
    },
    {
      "name": "Client",
      "path": "client"
    },
    {
      "name": "Docs",
      "path": "docs"
    }
  ],
  "settings": {
    "files.exclude": {
      "**/.git": true,
      "**/node_modules": true
    }
  }
}
```

Open with: `code qsolive.code-workspace`

## Next Steps

1. ✅ VS Code configured
2. ✅ Extensions installed
3. ✅ Python and Node.js ready
4. → Start building! See [client-setup.md](client-setup.md) and [deployment.md](deployment.md)

## Additional Resources

- [VS Code Python Tutorial](https://code.visualstudio.com/docs/python/python-tutorial)
- [VS Code JavaScript Tutorial](https://code.visualstudio.com/docs/nodejs/nodejs-tutorial)
- [VS Code Tips and Tricks](https://code.visualstudio.com/docs/getstarted/tips-and-tricks)
