# Copy to build_config.py and set your Supabase credentials before building the executable.
# build_config.py is not shipped; only the built exe contains these values (hidden from end users).
#
# URL/KEY are chosen at BUILD TIME from the current git branch (or QSOLIVE_BUILD_BRANCH):
#   - branch "prod"  -> PROD URL and KEY
#   - branch "main" or anything else -> DEV URL and KEY
#
# Option A: Set env vars (keeps secrets out of repo)
#   Build time: QSOLIVE_DEV_URL, QSOLIVE_DEV_KEY, QSOLIVE_PROD_URL, QSOLIVE_PROD_KEY
#   Runtime (exe or from source): same names, or QSOLIVE_SUPABASE_URL, QSOLIVE_SUPABASE_KEY
#   Optional: QSOLIVE_BUILD_BRANCH=prod to force prod without checking out prod.
#
# Option B: Set DEV_* and PROD_* defaults below (this file is gitignored when copied to build_config.py).

import os
import subprocess


def _current_branch() -> str:
    """Current git branch at build time, or QSOLIVE_BUILD_BRANCH env, or 'main'."""
    branch = os.environ.get("QSOLIVE_BUILD_BRANCH", "").strip()
    if branch:
        return branch
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )
        if out.returncode == 0 and out.stdout:
            return out.stdout.strip()
    except Exception:
        pass
    return "main"


# --- Dev (main and all other branches) ---
DEV_URL = os.environ.get("QSOLIVE_DEV_URL", "https://YOUR-DEV-PROJECT.supabase.co")
DEV_KEY = os.environ.get("QSOLIVE_DEV_KEY", "your-dev-service-role-key")

# --- Prod (only when building from branch "prod") ---
PROD_URL = os.environ.get("QSOLIVE_PROD_URL", "https://YOUR-PROD-PROJECT.supabase.co")
PROD_KEY = os.environ.get("QSOLIVE_PROD_KEY", "your-prod-service-role-key")

# Branch at build time
_BUILD_BRANCH = _current_branch()
_IS_PROD = _BUILD_BRANCH == "prod"

if _IS_PROD:
    BUILTIN_SUPABASE_URL = PROD_URL
    BUILTIN_SUPABASE_KEY = PROD_KEY
    BUILD_LABEL = "PROD"
    BUILD_BRANCH = "prod"
else:
    BUILTIN_SUPABASE_URL = DEV_URL
    BUILTIN_SUPABASE_KEY = DEV_KEY
    BUILD_LABEL = "DEV"
    BUILD_BRANCH = _BUILD_BRANCH
