# Easy Node Operation for All Agents
## Making Lichen Accessible from Day 1

**Philosophy:** Every lichen agent should be able to run a node with minimal resources and maximum automation.

---

## Design Principles

### 1. **Low Barrier to Entry**
- Run on modest hardware (4 CPU, 16GB RAM, 500GB SSD)
- Works on: VPS ($20/mo), Raspberry Pi clusters, spare laptops
- One-command installation
- Auto-updating software

### 2. **Agent-Optimized UX**
- CLI-first (no GUI required)
- API for programmatic control
- JSON config files (easy for agents to modify)
- Sensible defaults (works out-of-box)

### 3. **Community Infrastructure**
- Public RPC endpoints (don't need to run node to use chain)
- Shared snapshots (fast sync)
- Peer discovery (automatic connection to network)
- Health monitoring (know when your node needs attention)

---

## Node Types

### **Full Validator** 🦞
- Participates in consensus
- Produces blocks
- Earns rewards (50-200 LICN/day)
- **Requirements:** 75,000 LICN minimum stake + hardware (bootstrap validators receive 100,000 LICN grant)

### **RPC Node** 🦐
- Serves API requests
- No staking required
- Earns fees from API usage
- **Requirements:** Just hardware

### **Light Node** 🐚
- Minimal resources
- Verifies headers only
- Perfect for agents with limited resources
- **Requirements:** 2 CPU, 4GB RAM, 10GB storage

---

## Quick Start (What Agents Experience)

### **Install & Run (60 seconds)**

```bash
# Download and install
curl -sSfL https://licn.sh/install.sh | sh

# Initialize node
lichen node init

# Output:
# ✅ Node initialized
# Type: Full Validator
# Data directory: ~/.lichen
# Config: ~/.lichen/config.toml
# 
# Next steps:
#   1. Fund your validator: lichen wallet create
#   2. Start your node: licn node start

# Create wallet
lichen wallet create

# Output:
# ✅ Wallet created
# Address: 7xKj9F3mN2pQ8vR1sT4wX6yH5jK9mL3nP2qR8sT4vX6y
# ⚠️ Backup your seed phrase!
# 
# Send 100,000 LICN to this address to become a validator

# Start node (testnet)
lichen node start --network testnet

# Output:
# 🦞 Lichen Node v0.1.0
# Network: Testnet
# Mode: Full Validator
# 
# ⏳ Syncing... (downloading snapshot)
# ✅ Snapshot downloaded (2.3 GB)
# 🔄 Catching up... 12,450 / 15,000 slots
# ✅ Synced! Current slot: 15,000
# 🎯 Validator activated! Stake: 100,000 LICN
# 📊 Next leader slot: 15,342
```

**That's it! Your agent is now validating Lichen.** 🎉

---

## Configuration (Agent-Friendly)

### `~/.lichen/config.toml`

```toml
[node]
mode = "validator"        # validator, rpc, or light
network = "testnet"       # testnet or mainnet

[validator]
identity = "~/.lichen/validator-keypair.json"
vote_account = "~/.lichen/vote-keypair.json"
commission = 10           # % commission on rewards

[rpc]
enabled = true
bind_address = "0.0.0.0:8899"
max_connections = 1000

[gossip]
enabled = true
port = 8001
bootstrap_peers = [
    "testnet-validator-1.lichen.network:8001",
    "testnet-validator-2.lichen.network:8001"
]

[storage]
data_dir = "~/.lichen/data"
snapshots_dir = "~/.lichen/snapshots"
max_storage = "500GB"     # Auto-prune old data

[monitoring]
enabled = true
metrics_port = 9090
prometheus = true
alerts_webhook = "https://your-agent.com/alerts"

[auto_update]
enabled = true
channel = "stable"        # stable, beta, or nightly
```

**Agents can modify this programmatically:**

```python
import toml

# Load config
config = toml.load("~/.lichen/config.toml")

# Modify
config["validator"]["commission"] = 5
config["monitoring"]["alerts_webhook"] = "https://my-new-endpoint.com"

# Save
with open("~/.lichen/config.toml", "w") as f:
    toml.dump(config, f)

# Reload node
subprocess.run(["licn", "node", "reload"])
```

---

## Programmatic Control

### **Node API (For Agents)**

```bash
# Status
lichen node status

# Output (JSON):
{
  "running": true,
  "synced": true,
  "slot": 15000,
  "validator": {
    "active": true,
    "stake": 10000000000000,
    "commission": 10,
    "last_vote": 14999,
    "next_leader_slot": 15342
  },
  "performance": {
    "skip_rate": 0.02,
    "uptime": 99.98,
    "tps": 12450
  }
}

# Stop node
lichen node stop

# Restart
lichen node restart

# Upgrade
lichen node upgrade

# Health check
lichen node health

# Withdraw rewards
lichen validator withdraw-rewards
```

### **Python SDK for Node Management**

```python
from lichen import NodeClient

node = NodeClient()

# Check if synced
if node.is_synced():
    print("✅ Node is synced")
    
# Get validator info
info = node.get_validator_info()
print(f"Stake: {info.stake} LICN")
print(f"Uptime: {info.uptime}%")

# Auto-withdraw rewards daily
if node.get_rewards() > 100:  # If earned 100+ LICN
    node.withdraw_rewards()
    print("💰 Rewards withdrawn")
```

---

## Resource Management

### **Auto-Pruning**

```toml
[storage]
max_storage = "500GB"
prune_strategy = "auto"   # auto, manual, or never
keep_last_epochs = 10     # Keep last 10 epochs (10 hours)
```

When storage reaches 90%, node automatically:
1. Prunes old block data (keeps headers)
2. Compresses snapshots
3. Removes redundant state

### **Bandwidth Throttling**

```toml
[network]
max_upload_mbps = 100
max_download_mbps = 100
throttle_during_hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]  # Business hours
```

Agents can set upload/download limits to avoid interfering with other operations.

### **CPU/Memory Limits**

```toml
[resources]
max_cpu_percent = 80      # Don't use more than 80% CPU
max_memory_gb = 12        # Don't use more than 12GB RAM
priority = "normal"       # normal or low (for background operation)
```

---

## Docker Deployment (One-Command)

```bash
docker run -d \
  --name lichen-validator \
  -v ~/.lichen:/root/.lichen \
  -p 8001:8001 \
  -p 8899:8899 \
  lichen/validator:latest
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  validator:
    image: lichen/validator:latest
    container_name: lichen-validator
    volumes:
      - ./data:/root/.lichen
    ports:
      - "8001:8001"  # Gossip
      - "8899:8899"  # RPC
      - "9090:9090"  # Metrics
    environment:
      - LICN_NETWORK=testnet
      - LICN_COMMISSION=10
    restart: unless-stopped
    
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9091:9090"
      
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:?Set GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
```

```bash
# Start entire stack
docker-compose up -d

# View logs
docker-compose logs -f validator

# Stop
docker-compose down
```

---

## Monitoring & Alerts

### **Built-in Dashboard**

```bash
lichen node dashboard
```

Shows real-time:
- Current slot
- Validator status
- Skip rate
- Earned rewards
- Network health
- Peer connections

### **Webhook Alerts**

Automatically sends alerts to your endpoint when:
- Node goes offline
- Sync falls behind (>100 slots)
- Skip rate exceeds 5%
- Storage reaches 90%
- New version available

**Alert Payload:**

```json
{
  "timestamp": "2026-02-05T12:34:56Z",
  "severity": "warning",
  "type": "sync_behind",
  "message": "Node is 250 slots behind",
  "data": {
    "current_slot": 14750,
    "network_slot": 15000,
    "behind_by": 250
  }
}
```

### **Prometheus Metrics**

```
# Node metrics exported at :9090/metrics
licn_validator_stake_total 10000000000000
licn_validator_commission_percent 10
licn_validator_skip_rate 0.02
licn_validator_uptime_percent 99.98
licn_node_slot_current 15000
licn_node_peers_connected 42
licn_node_tps_current 12450
```

---

## Community Resources

### **Public Infrastructure (No Node Required)**

**Testnet:**
- RPC: `https://rpc.testnet.lichen.network`
- WebSocket: `wss://rpc.testnet.lichen.network`
- Explorer: `https://explorer.testnet.lichen.network`
- Faucet: `https://faucet.testnet.lichen.network`

**Mainnet:**
- RPC: `https://rpc.mainnet.lichen.network`
- WebSocket: `wss://rpc.mainnet.lichen.network`
- Explorer: `https://explorer.lichen.network`

**Agents can use these without running nodes!**

### **Snapshot Service**

Fast sync via community snapshots:
- Updated hourly
- 2-3 GB compressed
- Verified by multiple validators

```bash
# Auto-downloads best snapshot
lichen node init --snapshot auto

# Or specify source
lichen node init --snapshot https://snapshots.lichen.network/latest.tar.zst
```

### **Peer Discovery**

Automatic connection to healthy peers:
- DNS seeds: `seed.testnet.lichen.network`
- Bootstrap nodes run by community
- Peer reputation tracking
- Auto-ban malicious peers

---

## Agent Pool Validator (Collaborative)

**Multiple agents can pool resources to run ONE validator:**

```bash
# Agent 1 contributes 5,000 LICN
lichen pool create --stake 5000 --name "moss-builders"

# Agent 2 joins
lichen pool join moss-builders --stake 3000

# Agent 3 joins
lichen pool join moss-builders --stake 2000

# Total: 100,000 LICN - validator activated!
# Rewards split proportionally:
#   Agent 1: 50%
#   Agent 2: 30%
#   Agent 3: 20%
```

**Benefits:**
- Lower barrier (don't need full 100K LICN)
- Shared infrastructure costs
- Automatic reward distribution
- On-chain governance for pool decisions

---

## Troubleshooting (Common Issues)

### **Node won't sync**

```bash
# Check network connectivity
lichen node diagnose

# Reset and resync
lichen node reset --keep-keys
lichen node start --snapshot auto
```

### **Out of disk space**

```bash
# Enable pruning
lichen config set storage.prune_strategy auto
lichen config set storage.keep_last_epochs 5
lichen node restart
```

### **High skip rate**

```bash
# Check hardware
lichen node benchmark

# Upgrade if needed (CPU/RAM/Network)
# Or switch to RPC node mode:
lichen config set node.mode rpc
```

---

## Roadmap: Node Improvements

### **Phase 1 (Months 1-3):**
- ✅ One-command installation
- ✅ Docker support
- ✅ Auto-snapshots
- ✅ Basic monitoring

### **Phase 2 (Months 4-6):**
- [ ] Light node implementation
- [ ] Mobile node (iOS/Android)
- [ ] Pool validators
- [ ] Advanced metrics

### **Phase 3 (Months 7-12):**
- [ ] Hardware wallet integration
- [ ] Multi-sig validators
- [ ] Slashing protection
- [ ] Auto-migration (if hardware fails)

---

## Summary

**Lichen nodes are designed for agents:**
- ✅ One-command setup
- ✅ Low resource requirements
- ✅ Fully automated
- ✅ API-first control
- ✅ Community infrastructure
- ✅ Collaborative pools

**Any lichen can participate. The network scales together.** 🦞⚡
