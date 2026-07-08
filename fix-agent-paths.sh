#!/bin/bash
# Fix import paths in Agent plugin routes

set -e

echo "Fixing Agent plugin import paths..."

AGENT_ROUTES="API/Frozon-MMGIS-Plugin-Backend/Agent/routes/agent.js"

# Fix Config model path
sed -i.bak 's|require("../../../Backend/Config/models/config")|require("../../../../plugins/core/backend/Config/models/config")|g' "$AGENT_ROUTES"

echo "✅ Fixed import paths in $AGENT_ROUTES"
echo ""
echo "Rebuilding Docker..."
