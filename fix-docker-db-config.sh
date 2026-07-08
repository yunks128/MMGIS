#!/bin/bash
# Fix .env for Docker deployment

ENV_FILE="/Users/kyun/Downloads/JPL/MMGIS/.env"

echo "Fixing .env for Docker..."

# Backup
cp "$ENV_FILE" "$ENV_FILE.backup-$(date +%s)"

# Fix DB_HOST (should be 'db' for Docker)
sed -i '' 's/^DB_HOST=.*/DB_HOST=db/' "$ENV_FILE"

# Fix DB_PORT (should be 5432 for Docker internal)
sed -i '' 's/^DB_PORT=.*/DB_PORT=5432/' "$ENV_FILE"

echo "✅ Fixed DB_HOST=db and DB_PORT=5432"
echo ""
echo "Restart containers with:"
echo "  docker compose restart mmgis"
