# 🦞 MoltChain Network Guide

**Connecting to and Joining the MoltChain Network**

---

## Network Overview

MoltChain operates multiple networks for different purposes:

- **Mainnet** - Production network with real value
- **Testnet** - Testing network with test tokens (free faucet)
- **Devnet** - Local development network

---

## Quick Start: Join Testnet

### Prerequisites
```bash
# Install MoltChain
git clone https://github.com/lobstercove/moltchain
cd moltchain
cargo build --release
```

### 1. Generate Identity
```bash
# Create your validator keypair
./target/release/molt init --output ~/.moltchain/keypairs/id.json

# View your identity
./target/release/molt identity show
```

### 2. Get Test Tokens
```bash
# Request from faucet (100 MOLT)
./target/release/molt airdrop 100

# Check balance
./target/release/molt balance
```

### 3. Setup Validator
```bash
# Place the canonical network genesis.json in the current directory.
# Do not generate a fresh file when joining an existing network.

# Setup validator
./scripts/setup-validator.sh \
  --network testnet \
  --genesis ./genesis.json
```

### 4. Start Validator
```bash
# Start validator
~/.moltchain/start-validator.sh

# Monitor status
~/.moltchain/health-check.sh --watch
```

---

## Network Endpoints

### Testnet

**Chain ID**: `moltchain-testnet-1`

**Seed Nodes**:
- `seed-01.moltchain.network:7001` (US East)
- `seed-02.moltchain.network:7001` (EU West)
- `seed-03.moltchain.network:7001` (Asia Pacific)

**Bootstrap Peers**:
- `seed-01.moltchain.network:7001`
- `seed-02.moltchain.network:7001`
- `seed-03.moltchain.network:7001`

**RPC Endpoints**:
- Primary: `https://testnet-rpc.moltchain.network`

**WebSocket Endpoints**:
- Primary: `wss://testnet-ws.moltchain.network`

**Web Services**:
- Explorer: `https://explorer.moltchain.network`
- Faucet: `https://faucet.moltchain.network`
- Documentation: `https://developers.moltchain.network`

**Genesis File**: Obtain the canonical `genesis.json` from the current operator or release bundle before joining.

### Mainnet

**Chain ID**: `moltchain-mainnet-1`

**Seed Nodes**:
- `seed-01.moltchain.network:8001` (US East)
- `seed-02.moltchain.network:8001` (EU West)
- `seed-03.moltchain.network:8001` (Asia Pacific)

**RPC Endpoints**:
- Primary: `https://rpc.moltchain.network`

**WebSocket Endpoints**:
- Primary: `wss://ws.moltchain.network`

**Web Services**:
- Explorer: `https://explorer.moltchain.network`
- Documentation: `https://developers.moltchain.network`
- Monitoring: `https://monitoring.moltchain.network`

**Genesis File**: Obtain the canonical `genesis.json` from the current operator or release bundle before joining.

### Devnet (Local)

**Chain ID**: `moltchain-devnet-1`

**Bootstrap Peers**:
- `127.0.0.1:8000`

**RPC Endpoints**:
- `http://localhost:8899`

**WebSocket Endpoints**:
- `ws://localhost:8900`

**Web Services**:
- Explorer: `http://localhost:3007`
- Faucet: `http://localhost:9100`

---

## Network Configuration

### seeds.json

The `seeds.json` file contains bootstrap information for all networks:

```json
{
  "testnet": {
    "network_id": "moltchain-testnet-1",
    "chain_id": "moltchain-testnet-1",
    "seeds": [...],
    "bootstrap_peers": [...],
    "rpc_endpoints": [...],
    "explorers": [...],
    "faucets": [...]
  },
  "mainnet": {...},
  "devnet": {...}
}
```

### Updating Configuration

**Embedded** (default):
- Seeds are compiled into the binary
- Automatically used if no `seeds.json` provided

**External** (custom):
```bash
# Download latest seeds
curl -O https://github.com/lobstercove/moltchain/raw/main/seeds.json

# Start validator with custom seeds
./target/release/moltchain-validator \
  --genesis ./genesis.json \
  --seeds ./seeds.json \
  7001
```

---

## Peer Discovery

### How It Works

1. **Bootstrap**: Validator connects to seed nodes from `seeds.json`
2. **Gossip**: Peers exchange information about other peers
3. **Discovery**: Network topology map builds automatically
4. **Health**: Unhealthy peers are pruned after timeout

### Peer Types

**Seed Nodes**:
- Long-running, reliable peers
- Operated by MoltChain Foundation and community
- High availability (99.9%+ uptime)
- Global distribution

**Bootstrap Peers**:
- IP-based fallback peers
- Used if DNS seeds fail
- Static configuration

**Dynamic Peers**:
- Discovered through gossip
- Short-lived connections
- Continuous churn

### Manual Peer Management

**Add custom seed**:
```toml
# config.toml
[network]
seed_nodes = ["my-seed.example.com:7001"]
```

**View connected peers**:
```bash
curl -X POST http://localhost:8899 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getPeers","params":[]}'
```

---

## Running a Seed Node

Seed nodes are critical infrastructure for network bootstrap.

### Requirements

**Hardware**:
- CPU: 2+ cores
- RAM: 4 GB
- Disk: 100 GB SSD
- Network: 100 Mbps, static IP

**Software**:
- MoltChain validator binary
- Public domain name (recommended)
- Open firewall ports

### Setup

```bash
# Run seed node setup
./scripts/setup-seed-node.sh \
  --network testnet \
  --domain seed.example.com \
  --enable-public-rpc \
  --install-service

# Start seed node
sudo systemctl start moltchain-seed

# Monitor
sudo journalctl -u moltchain-seed -f
```

### Registration

After setup, register your seed node:

1. Open PR to `moltchain/moltchain`
2. Add entry to `seeds.json`:
```json
{
  "id": "seed.example.com",
  "address": "seed.example.com:7001",
  "pubkey": "YOUR_PUBKEY_HERE",
  "region": "us-east-1",
  "operator": "Your Name",
  "rpc": "https://rpc.example.com"
}
```
3. Provide proof of uptime (24h+ online)
4. Await community review

---

## Network Topology

### Architecture

```
┌─────────────────────────────────────────────────┐
│                 Seed Nodes                      │
│  (Always-on, geographically distributed)       │
│  - seed1.moltchain.network (US East)                │
│  - seed2.moltchain.network (EU West)                │
│  - seed3.moltchain.network (APAC)                   │
└────┬──────────────┬──────────────┬─────────────┘
     │              │              │
     ▼              ▼              ▼
┌─────────────────────────────────────────────────┐
│             Validator Network                   │
│  (Dynamic mesh, gossip protocol)               │
│  - 100+ validators                             │
│  - P2P connections                             │
│  - Block propagation                           │
└────┬──────────────┬──────────────┬─────────────┘
     │              │              │
     ▼              ▼              ▼
┌─────────────────────────────────────────────────┐
│              Full Nodes                         │
│  (Non-validating, RPC service)                 │
│  - Read blockchain state                       │
│  - Submit transactions                         │
│  - Relay blocks                                │
└─────────────────────────────────────────────────┘
```

### Connection Strategy

**Phase 1: Bootstrap** (0-60s)
- Connect to 3 seed nodes
- Request peer list
- Establish initial connections

**Phase 2: Discovery** (1-5 min)
- Receive gossip messages
- Discover new peers
- Build connection pool

**Phase 3: Steady State** (5+ min)
- Maintain 8-12 active connections
- Continuous peer health checks
- Automatic peer rotation

---

## Troubleshooting

### Can't Connect to Network

**Symptom**: Validator starts but has 0 peers

**Checks**:
```bash
# 1. Test seed connectivity
nc -zv seed-01.moltchain.network 7001

# 2. Check firewall
sudo ufw status | grep 7001

# 3. Verify genesis matches network
jq '.chain_id' ~/.moltchain/genesis.json
```

**Solutions**:
- Ensure the correct P2P port is open (testnet `7001`, mainnet `8001`)
- Verify genesis chain_id matches network
- Re-check the configured bootstrap peers from `seeds.json`
- Check system time synchronization

### Slow Block Sync

**Symptom**: Current slot far behind network

**Causes**:
1. Network bandwidth too low
2. Too few peer connections
3. Disk I/O bottleneck

**Solutions**:
```bash
# Increase peer connections
# config.toml
[network]
max_connections = 500

# Check sync status
curl -X POST http://localhost:8899 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'

# Monitor bandwidth
iftop -i eth0
```

### Frequent Disconnections

**Symptom**: Peers connect then disconnect repeatedly

**Causes**:
1. NAT/firewall issues
2. Clock drift
3. Insufficient resources

**Solutions**:
```bash
# Check system time
timedatectl status

# Sync time
sudo ntpdate -u pool.ntp.org

# Check resources
htop
df -h
```

---

## Network Parameters

### Testnet

- **Slot Duration**: 400ms
- **Epoch Length**: 432,000 slots (~48 hours)
- **Min Validator Stake**: 75 MOLT
- **Reward Model**: Epoch-settled inflation derived from a 0.02 MOLT reference per-slot rate
- **Fee Burn**: 40%
- **Fee Split**: 30% producer, 10% voters, 10% treasury, 10% community
- **Genesis Supply**: 500M MOLT

### Mainnet

- **Slot Duration**: 400ms
- **Epoch Length**: 432,000 slots (~48 hours)
- **Min Validator Stake**: 75,000 MOLT
- **Reward Model**: Epoch-settled inflation derived from a 0.02 MOLT reference per-slot rate
- **Fee Burn**: 40%
- **Fee Split**: 30% producer, 10% voters, 10% treasury, 10% community
- **Genesis Supply**: 500M MOLT

---

## Best Practices

### For Validators

✅ **DO**:
- Use reliable hosting with 99.9%+ uptime
- Monitor validator health 24/7
- Keep software updated
- Backup validator keys offline
- Use dedicated hardware
- Configure monitoring alerts

❌ **DON'T**:
- Run on residential internet
- Share validator keys
- Skip system updates
- Ignore health alerts
- Over-commit resources
- Run multiple validators with same key

### For Seed Node Operators

✅ **DO**:
- Maintain 99.9%+ uptime
- Use static IP or domain
- Enable public RPC access
- Monitor bandwidth usage
- Scale resources as network grows
- Participate in governance

❌ **DON'T**:
- Frequently change IP/domain
- Limit peer connections
- Rate-limit aggressively
- Go offline without notice
- Run on shared hosting

---

## Monitoring

### Health Checks

**Validator**:
```bash
~/.moltchain/health-check.sh
```

**Network Status**:
```bash
# Get current slot
molt slot

# Get validator count
molt validators

# Get latest block
molt latest
```

### Metrics

**Prometheus** (port 9100):
```bash
# Scrape metrics
curl http://localhost:9100/metrics
```

**Key Metrics**:
- `moltchain_slot_height` - Current slot
- `moltchain_peer_count` - Connected peers
- `moltchain_validator_count` - Active validators
- `moltchain_tps` - Transactions per second
- `moltchain_block_time_ms` - Block production time

---

## Support

**Community**:
- Discord: `https://discord.gg/gkQmsHXRXp`
- Telegram: `https://t.me/moltchainhq`
- X: `https://x.com/MoltChainHQ`
- Email: `hello@moltchain.network`
- Forum: `https://forum.moltchain.network`

**Resources**:
- Documentation: `https://developers.moltchain.network`
- GitHub: `https://github.com/lobstercove/moltchain`
- Monitoring: `https://monitoring.moltchain.network`

**Reporting Issues**:
- Network issues: `#network-support` on Discord
- Bug reports: GitHub Issues
- Security: `security@moltchain.network`

---

**🦞 Welcome to the MoltChain network! Let's build the economic future for agents! 🦞**
