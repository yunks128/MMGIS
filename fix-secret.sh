#!/bin/bash
# Generate a secure SECRET for MMGIS session cookies

set -e

echo "========================================"
echo "Fixing SECRET Environment Variable"
echo "========================================"

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "Backing up current .env..."
cp .env .env.backup-secret-$(date +%s)

# Generate a secure 64-character random string using openssl
SECRET=$(openssl rand -hex 32)

echo ""
echo "Generated secure SECRET (64 characters)"

# Update or add SECRET to .env
if grep -q "^SECRET=" .env; then
    sed -i.tmp "s/^SECRET=.*/SECRET=$SECRET/" .env
    echo "✅ Updated existing SECRET in .env"
else
    echo "SECRET=$SECRET" >> .env
    echo "✅ Added SECRET to .env"
fi

rm -f .env.tmp

echo ""
echo "✅ SECRET configured successfully"
echo ""
echo "Restarting Docker containers..."

docker-compose down
docker-compose up -d

echo ""
echo "✅ Containers restarting"
echo ""
echo "Wait ~30 seconds for services to initialize, then test:"
echo "   http://localhost:8888"
echo ""
echo "Monitor logs with:"
echo "   docker-compose logs -f mmgis"
echo ""
