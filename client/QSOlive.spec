# -*- mode: python ; coding: utf-8 -*-
# Run this spec from the client/ directory:  pyinstaller --clean QSOlive.spec

import os
import sys
# Spec may be exec'd with cwd != client; use dir of spec file when PyInstaller provides it
try:
    _client_dir = os.path.dirname(os.path.abspath(spec_file))
except NameError:
    _client_dir = os.getcwd()
if _client_dir not in sys.path:
    sys.path.insert(0, _client_dir)
os.chdir(_client_dir)
try:
    import build_config  # creates build_branch.txt with current branch for exe to read when frozen
except Exception:
    with open(os.path.join(_client_dir, 'build_branch.txt'), 'w') as _f:
        _f.write(os.environ.get('QSOLIVE_BUILD_BRANCH', 'main'))

a = Analysis(
    ['qsolive_client.py'],
    pathex=[_client_dir],
    binaries=[],
    datas=[('build_branch.txt', '.')],
    hiddenimports=['maidenhead'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='QSOlive',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['icon.ico'],
)
