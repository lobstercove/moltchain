#!/bin/bash
# MoltChain Programs - Deploy All Services
# Run this script to deploy compiler + faucet + RPC/WS

set -e

echo "🦞 MoltChain Programs Deployment Script"
echo "========================================"
echo ""

# Configuration
NETWORK="${NETWORK:-testnet}"
RPC_PORT="${RPC_PORT:-8899}"
COMPILER_PORT="${COMPILER_PORT:-8901}"
FAUCET_PORT="${FAUCET_PORT:-8901}"

echo "📋 Configuration:"
echo "  Network: $NETWORK"
echo "  RPC Port: $RPC_PORT"
echo "  Compiler Port: $COMPILER_PORT"
echo "  Faucet Port: $FAUCET_PORT"
echo ""

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command -v cargo &> /dev/null; then
    echo "❌ cargo not found. Install Rust: https://rustup.rs/"
    exit 1
fi

if ! command -v rustc &> /dev/null; then
    echo "❌ rustc not found"
    exit 1
fi

# Check for WASM target
if ! rustup target list | grep -q "wasm32-unknown-unknown (installed)"; then
    echo "📦 Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Check for wasm-opt (optional but recommended)
if ! command -v wasm-opt &> /dev/null; then
    echo "⚠️  wasm-opt not found (optional). Install: https://github.com/WebAssembly/binaryen"
fi

# Check for clang (for C compilation)
if ! command -v clang &> /dev/null; then
    echo "⚠️  clang not found (needed for C/C++ compilation)"
fi

# Check for asc (for AssemblyScript)
if ! command -v asc &> /dev/null; then
    echo "⚠️  asc not found (needed for AssemblyScript compilation)"
fi

echo "✅ Dependencies OK"
echo ""

# Build MoltChain Core
echo "🔨 Building MoltChain Core..."
cd ..
cargo build --release
echo "✅ Core built"
echo ""

# Build Compiler Service
echo "🔨 Building Compiler Service..."
cd compiler
cargo build --release
echo "✅ Compiler built"
echo ""

# Build Faucet Service
if [ "$NETWORK" != "mainnet" ]; then
    echo "💧 Building Faucet Service..."
    cd ../faucet
    cargo build --release
    echo "✅ Faucet built"
    echo ""
fi

# Create config files
cd ..
echo "📝 Creating config files..."

# RPC config
cat > config/rpc.toml <<EOF
[rpc]
host = "0.0.0.0"
port = $RPC_PORT

[ws]
host = "0.0.0.0"
port = $RPC_PORT

[limits]
max_connections = 1000
request_timeout_seconds = 30
EOF

# Compiler config
mkdir -p config
cat > config/compiler.toml <<EOF
[compiler]
port = $COMPILER_PORT
timeout_seconds = 60
max_code_size_mb = 1
max_wasm_size_mb = 10

[sandbox]
enabled = true
docker_image = "moltchain/compiler-sandbox"
EOF

# Faucet config
if [ "$NETWORK" != "mainnet" ]; then
    cat > config/faucet.toml <<EOF
[faucet]
port = $FAUCET_PORT
rpc_url = "http://localhost:$RPC_PORT"
network = "$NETWORK"

[limits]
max_per_request = 100
cooldown_seconds = 3600

[keypair]
# Generate with: molt keygen --output faucet-keypair.json
path = "config/faucet-keypair.json"
EOF
fi

echo "✅ Config files created"
echo ""

# Generate faucet keypair if needed
if [ "$NETWORK" != "mainnet" ] && [ ! -f "config/faucet-keypair.json" ]; then
    echo "🔑 Generating faucet keypair..."
    if command -v molt &> /dev/null; then
        molt keygen --output config/faucet-keypair.json
    elif [ -f "$(pwd)/target/release/molt" ]; then
        $(pwd)/target/release/molt keygen --output config/faucet-keypair.json
    else
        echo "❌ Error: molt CLI not found. Build it first with 'cargo build --release -p molt-cli'"
        echo "   Then run this script again to generate the faucet keypair."
        exit 1
    fi
    echo "✅ Faucet keypair generated"
    echo ""
fi

# Create systemd services
echo "📦 Creating systemd services..."

sudo tee /etc/systemd/system/moltchain-rpc.service > /dev/null <<EOF
[Unit]
Description=MoltChain RPC Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/target/release/moltchain --rpc-port $RPC_PORT
Restart=always
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
ReadWritePaths=$(pwd)/data

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/moltchain-compiler.service > /dev/null <<EOF
[Unit]
Description=MoltChain Compiler Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/compiler
Environment="PORT=$COMPILER_PORT"
ExecStart=$(pwd)/compiler/target/release/moltchain-compiler
Restart=always
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

if [ "$NETWORK" != "mainnet" ]; then
    sudo tee /etc/systemd/system/moltchain-faucet.service > /dev/null <<EOF
[Unit]
Description=MoltChain Faucet Service
After=network.target moltchain-rpc.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/faucet
Environment="PORT=$FAUCET_PORT"
Environment="RPC_URL=http://localhost:$RPC_PORT"
Environment="NETWORK=$NETWORK"
ExecStart=$(pwd)/faucet/target/release/moltchain-faucet
Restart=always
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
fi

echo "✅ Systemd services created"
echo ""

# Reload systemd
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload
echo "✅ Systemd reloaded"
echo ""

# Start services
echo "🚀 Starting services..."

sudo systemctl enable moltchain-rpc
sudo systemctl start moltchain-rpc
echo "✅ RPC service started"

sudo systemctl enable moltchain-compiler
sudo systemctl start moltchain-compiler
echo "✅ Compiler service started"

if [ "$NETWORK" != "mainnet" ]; then
    sudo systemctl enable moltchain-faucet
    sudo systemctl start moltchain-faucet
    echo "✅ Faucet service started"
fi

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "📊 Service Status:"
sudo systemctl status moltchain-rpc --no-pager | head -5
sudo systemctl status moltchain-compiler --no-pager | head -5
if [ "$NETWORK" != "mainnet" ]; then
    sudo systemctl status moltchain-faucet --no-pager | head -5
fi
echo ""

echo "🔗 Endpoints:"
echo "  RPC: http://localhost:$RPC_PORT"
echo "  WebSocket: ws://localhost:$RPC_PORT/ws"
echo "  Compiler: http://localhost:$COMPILER_PORT/compile"
if [ "$NETWORK" != "mainnet" ]; then
    echo "  Faucet: http://localhost:$FAUCET_PORT/faucet/request"
fi
echo ""

echo "📝 View logs:"
echo "  RPC: sudo journalctl -u moltchain-rpc -f"
echo "  Compiler: sudo journalctl -u moltchain-compiler -f"
if [ "$NETWORK" != "mainnet" ]; then
    echo "  Faucet: sudo journalctl -u moltchain-faucet -f"
fi
echo ""

echo "🧪 Test endpoints:"
echo "  curl http://localhost:$RPC_PORT -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"health\"}'"
echo "  curl http://localhost:$COMPILER_PORT/health"
if [ "$NETWORK" != "mainnet" ]; then
    echo "  curl http://localhost:$FAUCET_PORT/health"
fi
echo ""

echo "🦞 MoltChain Programs is ready!"
