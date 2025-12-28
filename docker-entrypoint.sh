#!/bin/sh
set -e

# Create runtime config file with analytics configuration
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  // Google Analytics 4 Measurement ID (optional)
  GA_MEASUREMENT_ID: "${GA_MEASUREMENT_ID:-}"
};
EOF

if [ -n "$GA_MEASUREMENT_ID" ]; then
  echo "Runtime config created with Google Analytics: $GA_MEASUREMENT_ID"
else
  echo "Runtime config created (no analytics configured)"
fi

# Execute the CMD
exec "$@"
