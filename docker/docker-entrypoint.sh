#!/bin/sh
set -e

: "${FUSIONAUTH_URL:?FUSIONAUTH_URL is required}"
: "${FUSIONAUTH_CLIENT_ID:?FUSIONAUTH_CLIENT_ID is required}"
: "${APP_URL:?APP_URL is required}"
: "${API_URL:?API_URL is required}"

cat > /usr/share/nginx/html/config.json <<EOF
{
  "fusionAuthUrl": "${FUSIONAUTH_URL}",
  "fusionAuthClientId": "${FUSIONAUTH_CLIENT_ID}",
  "appUrl": "${APP_URL}",
  "apiUrl": "${API_URL}"
}
EOF

exec "$@"
