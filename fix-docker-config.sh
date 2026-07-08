#!/bin/bash
# Fix Docker PostgreSQL configuration mismatch

echo "=== MMGIS Docker Configuration Fix ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found. Please copy sample.env to .env first."
    exit 1
fi

# Read current DB credentials from .env
DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2)
DB_PASS=$(grep "^DB_PASS=" .env | cut -d '=' -f2)
DB_NAME=$(grep "^DB_NAME=" .env | cut -d '=' -f2)
DB_HOST=$(grep "^DB_HOST=" .env | cut -d '=' -f2)

echo "Current .env database configuration:"
echo "  DB_HOST: $DB_HOST"
echo "  DB_USER: $DB_USER"
echo "  DB_PASS: $DB_PASS"
echo "  DB_NAME: $DB_NAME"
echo ""

# Check docker-compose.yml db service configuration
echo "docker-compose.yml db service expects:"
echo "  POSTGRES_USER: postgres"
echo "  POSTGRES_PASSWORD: postgres"
echo "  POSTGRES_DB: mmgis"
echo ""

echo "=== Issue Detected ==="
echo "The MMGIS app is trying to connect with credentials from .env,"
echo "but the PostgreSQL container is initialized with different credentials"
echo "in docker-compose.yml."
echo ""

echo "=== Solution Options ==="
echo ""
echo "Option 1 (Recommended): Update .env to match docker-compose.yml"
echo "  This will update your .env file with these values:"
echo "    DB_HOST=db"
echo "    DB_USER=postgres"
echo "    DB_PASS=postgres"
echo "    DB_NAME=mmgis"
echo ""
echo "Option 2: Update docker-compose.yml to match .env"
echo "  This will update docker-compose.yml to use your current .env values."
echo ""

read -p "Choose option (1 or 2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    echo "Updating .env file..."

    # Backup current .env
    cp .env .env.backup-$(date +%s)
    echo "Created backup: .env.backup-$(date +%s)"

    # Update .env
    sed -i.bak "s/^DB_HOST=.*/DB_HOST=db/" .env
    sed -i.bak "s/^DB_USER=.*/DB_USER=postgres/" .env
    sed -i.bak "s/^DB_PASS=.*/DB_PASS=postgres/" .env
    sed -i.bak "s/^DB_NAME=.*/DB_NAME=mmgis/" .env
    rm .env.bak

    echo "✓ .env updated successfully"
    echo ""
    echo "Now updating STAC services in docker-compose.yml to match..."

    # Update STAC services to use postgres/postgres
    sed -i.bak 's/POSTGRES_USER=username/POSTGRES_USER=postgres/g' docker-compose.yml
    sed -i.bak 's/POSTGRES_PASS=password/POSTGRES_PASS=postgres/g' docker-compose.yml
    rm docker-compose.yml.bak

    echo "✓ docker-compose.yml STAC services updated"

elif [ "$choice" = "2" ]; then
    echo ""
    echo "Updating docker-compose.yml..."

    # Backup docker-compose.yml
    cp docker-compose.yml docker-compose.yml.backup-$(date +%s)
    echo "Created backup: docker-compose.yml.backup-$(date +%s)"

    # Update docker-compose.yml db service
    sed -i.bak "s/POSTGRES_USER=postgres/POSTGRES_USER=$DB_USER/g" docker-compose.yml
    sed -i.bak "s/POSTGRES_PASSWORD=postgres/POSTGRES_PASSWORD=$DB_PASS/g" docker-compose.yml
    sed -i.bak "s/POSTGRES_DB=mmgis/POSTGRES_DB=$DB_NAME/g" docker-compose.yml

    # Update STAC services
    sed -i.bak "s/POSTGRES_USER=username/POSTGRES_USER=$DB_USER/g" docker-compose.yml
    sed -i.bak "s/POSTGRES_PASS=password/POSTGRES_PASS=$DB_PASS/g" docker-compose.yml

    # Update healthcheck
    sed -i.bak "s/pg_isready -d postgres -U \${DB_USER}/pg_isready -d $DB_NAME -U $DB_USER/g" docker-compose.yml

    rm docker-compose.yml.bak

    echo "✓ docker-compose.yml updated successfully"
else
    echo "Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "=== Next Steps ==="
echo "1. Stop and remove existing containers:"
echo "   docker-compose down -v"
echo ""
echo "2. Rebuild and start:"
echo "   docker-compose up -d --build"
echo ""
echo "3. Check logs:"
echo "   docker logs mmgis-mmgis-1 -f"
