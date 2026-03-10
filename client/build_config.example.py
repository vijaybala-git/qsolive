# Copy to build_config.py and set your Supabase credentials before building the executable.
# build_config.py is not shipped; only the built exe contains these values (hidden from end users).
BUILTIN_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
BUILTIN_SUPABASE_KEY = "your-service-role-or-anon-key"

# Optional: show in startup log and console which env/DB and branch (dev vs prod).
# BUILD_LABEL = "dev"   # or "prod"
# BUILD_BRANCH = "main" # or leave unset to try git at runtime
