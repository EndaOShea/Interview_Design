#!/bin/sh
set -e

# Create empty runtime config file (no app-level API keys)
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  // No app-level API keys - users provide their own through the UI
};
EOF

echo "Runtime config created - users must provide API keys through the UI"

# Execute the CMD
exec "$@"
