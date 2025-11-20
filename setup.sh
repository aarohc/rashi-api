#!/bin/bash

# Setup script to ensure Node.js 22 is used for Rashi API

echo "🔧 Setting up Rashi API environment..."

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 24.11.1
echo "📦 Switching to Node.js 24.11.1..."
nvm use 24.11.1

# Verify Node version
NODE_VERSION=$(node --version)
echo "✅ Current Node version: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v24\. ]]; then
    echo "❌ Error: Not using Node.js 24. Please install Node.js 24.11.1:"
    echo "   nvm install 24.11.1"
    echo "   nvm alias default 24.11.1"
    exit 1
fi

# Rebuild native modules
echo "🔨 Rebuilding native modules for Node.js 24.11.1..."
npm rebuild

echo "✅ Setup complete! Using Node.js 24.11.1"

