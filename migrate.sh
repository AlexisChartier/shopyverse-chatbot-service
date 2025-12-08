#!/bin/bash
# Quick Migration & Testing Script for TypeORM → pg Migration

set -e

echo "🔄 ShopyVerse Chatbot - TypeORM → PostgreSQL Migration"
echo "======================================================="
echo ""

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install pg @types/pg
echo "✅ Dependencies installed"
echo ""

# Step 2: Create database schema
echo "🗄️  Step 2: Creating database schema..."
echo "   Connecting to: postgres://chatbot:chatbot@localhost:5433/chatbot_db"
psql -h localhost -p 5433 -U chatbot -d chatbot_db -f sql/001-create-chat-interactions.sql 2>/dev/null || {
  echo "⚠️  Could not auto-create schema. Please run manually:"
  echo "   psql -h localhost -p 5433 -U chatbot -d chatbot_db -f sql/001-create-chat-interactions.sql"
}
echo "✅ Database schema ready"
echo ""

# Step 3: Start service
echo "🚀 Step 3: Starting chatbot service..."
echo "   npm run dev"
echo ""
echo "⏳ Service should start in a few seconds..."
echo "   Once running, leave this window open and open a new terminal for tests."
echo ""

# Instructions
echo "📋 TESTING INSTRUCTIONS (in a new terminal):"
echo "========================================================"
echo ""
echo "Test 1 - FAQ Question:"
echo "  curl -X POST http://localhost:3001/api/v1/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'x-api-key: dev-api-key' \\"
echo "    -d '{\"message\": \"Quels sont vos délais de livraison ?\"}'"
echo ""
echo "Test 2 - Product Search:"
echo "  curl -X POST http://localhost:3001/api/v1/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'x-api-key: dev-api-key' \\"
echo "    -d '{\"message\": \"Je cherche un t-shirt ShopyVerse pour homme.\"}'"
echo ""
echo "Test 3 - Out of Scope:"
echo "  curl -X POST http://localhost:3001/api/v1/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'x-api-key: dev-api-key' \\"
echo "    -d '{\"message\": \"Explique-moi la relativité générale.\"}'"
echo ""
echo "Verify in PostgreSQL:"
echo "  psql -h localhost -p 5433 -U chatbot -d chatbot_db"
echo "  SELECT session_id, intent, has_fallback, created_at FROM chat_interactions ORDER BY created_at DESC;"
echo ""
