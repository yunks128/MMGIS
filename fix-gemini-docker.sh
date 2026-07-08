#!/bin/bash
# Fix Gemini API key in Docker container
# This script ensures GEMINI_API_KEY is properly set for Docker deployment

set -e

echo "========================================"
echo "Fixing Gemini API Configuration"
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Copy sample.env to .env first:"
    echo "   cp sample.env .env"
    exit 1
fi

# Check if GEMINI_API_KEY is set in .env
if ! grep -q "^GEMINI_API_KEY=" .env; then
    echo "⚠️  GEMINI_API_KEY not found in .env"
    echo ""
    echo "Please add your Gemini API key to .env:"
    echo "   GEMINI_API_KEY=your_api_key_here"
    echo ""
    echo "Get your API key from: https://aistudio.google.com/app/apikey"
    exit 1
fi

# Check if GEMINI_API_KEY has a value
GEMINI_KEY=$(grep "^GEMINI_API_KEY=" .env | cut -d'=' -f2)
if [ -z "$GEMINI_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY is empty in .env"
    echo ""
    echo "Please set your Gemini API key in .env:"
    echo "   GEMINI_API_KEY=your_api_key_here"
    echo ""
    echo "Get your API key from: https://aistudio.google.com/app/apikey"
    exit 1
fi

echo "✅ GEMINI_API_KEY is set in .env"

# Check if WITH_AGENT is enabled
if ! grep -q "^WITH_AGENT=true" .env; then
    echo "⚠️  WITH_AGENT is not enabled in .env"
    read -p "Enable AI Agent? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Update or add WITH_AGENT=true
        if grep -q "^WITH_AGENT=" .env; then
            sed -i.bak 's/^WITH_AGENT=.*/WITH_AGENT=true/' .env
        else
            echo "WITH_AGENT=true" >> .env
        fi
        echo "✅ WITH_AGENT=true added to .env"
    fi
fi

# Check if Docker containers are running
if docker ps --format '{{.Names}}' | grep -q "mmgis"; then
    echo ""
    echo "Docker containers are running. Rebuilding to apply changes..."
    echo ""

    read -p "Rebuild and restart Docker containers? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping containers..."
        docker-compose down

        echo "Rebuilding MMGIS container..."
        docker-compose build mmgis

        echo "Starting containers..."
        docker-compose up -d

        echo ""
        echo "✅ Docker containers rebuilt and restarted"
        echo ""
        echo "Wait ~30 seconds for services to initialize, then test at:"
        echo "   http://localhost:8888"
    fi
else
    echo ""
    echo "⚠️  Docker containers are not running."
    echo ""
    read -p "Start Docker containers? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose up -d
        echo ""
        echo "✅ Docker containers started"
        echo ""
        echo "Wait ~30 seconds for services to initialize, then test at:"
        echo "   http://localhost:8888"
    fi
fi

echo ""
echo "========================================"
echo "Configuration Summary"
echo "========================================"
echo "GEMINI_API_KEY: Set ✅"
echo "WITH_AGENT: $(grep '^WITH_AGENT=' .env | cut -d'=' -f2 || echo 'Not set')"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:8888 in your browser"
echo "2. Test the Copilot/AI Agent feature"
echo "3. If issues persist, check logs: docker-compose logs -f mmgis"
echo ""
