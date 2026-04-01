#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  "VERCEL_TOKEN"
  "VERCEL_ORG_ID"
  "VERCEL_PROJECT_ID"
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

echo "Pulling Vercel production environment..."
npx vercel pull --yes --environment=production --token="$VERCEL_TOKEN"

echo "Building project for production..."
npx vercel build --prod --token="$VERCEL_TOKEN"

echo "Deploying prebuilt output to Vercel production..."
npx vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"

echo "Vercel production redeploy completed."
