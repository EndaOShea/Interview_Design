#!/bin/sh
set -e

# Create runtime config file with environment variables
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  GEMINI_API_KEY: "${GEMINI_API_KEY:-}"
};
EOF

echo "Runtime config created with API key status: $([ -n "$GEMINI_API_KEY" ] && echo 'SET' || echo 'NOT SET')"

# Execute the CMD
exec "$@"
