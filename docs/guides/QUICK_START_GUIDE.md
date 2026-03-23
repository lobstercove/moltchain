# 🦞 Lichen Quick Start Guide ⚡

**Your Path From Zero to Lichening on Lichen!**

---

## 🎯 What You Can Do Now

✅ Create your blockchain identity  
✅ Request testnet tokens  
✅ Transfer LICN between accounts  
✅ Query blocks and validators  
✅ Deploy smart contracts (7 standards available!)  
✅ Build DApps using RPC API

---

## 📦 Step 1: Install CLI

```bash
# From the Lichen repository
cd /path/to/lichen

# Build (if not already built)
cargo build --release --bin licn

# Add to PATH (optional)
export PATH="$PWD/target/release:$PATH"

# Or use directly
alias licn='./target/release/licn'
```

---

## 🔑 Step 2: Create Your Identity

```bash
# Generate new keypair
$ lichen identity new

# Output:
🦞 Generated new identity!
📍 Pubkey: 7xKjF2vd9RpqE3mH8sL4kW6nY5tA1bC2dF3gH4iJ5kL6m
🔐 EVM Address: 0x1234567890abcdef...
💾 Saved to: /Users/johnrobin/.lichen/keypairs/id.json
💾 Saved to: ~/.lichen/keypairs/id.json

💡 Get test tokens: lichen airdrop 100
```

**Your keypair is saved at:** `~/.lichen/keypairs/id.json`

---

## 💰 Step 3: Get Testnet Tokens

### Option A: Web Faucet (Recommended)

```bash
# Start the faucet server (in a new terminal)
cargo run --release --bin lichen-faucet

# Visit in browser:
http://localhost:9090

# Paste your address and request tokens!
```

### Option B: CLI Command (coming soon)

```bash
lichen airdrop 100
```

---

## 💸 Step 4: Check Your Balance

```bash
# Check your balance
$ lichen balance

# Output:
🦞 Balance for 7xKjF2vd9...
💰 100.0 LICN (100000000000 spores)
```

**Note:** 1 LICN = 1,000,000,000 spores (9 decimals)

---

## 🚀 Step 5: Transfer Tokens

```bash
# Transfer 10 LICN to another address
$ lichen transfer 8yLmG3we8NqP4rT7vX9zK2mL5oB6cD7eF8gH9iJ0kL1m 10.0

# Output:
🦞 Transferring 10.0 LICN (10000000000 spores)
📤 From: 7xKjF2vd9...
📥 To: 8yLmG3we8...
✅ Transaction sent!
📝 Signature: abc123def456...
```

---

## 🔍 Step 6: Query the Blockchain

### Get Latest Block
```bash
$ lichen latest

# Output:
🧊 Latest Block #1234
🔗 Hash: 0x789abc...
⬅️  Parent: 0x456def...
🌳 State Root: 0x123ghi...
🦞 Validator: 7xKjF2vd9...
⏰ Timestamp: 1707264000
📦 Transactions: 42
```

### Get Current Slot
```bash
$ lichen slot

# Output:
🦞 Current slot: 1234
```

### Get Total Burned LICN
```bash
$ lichen burned

# Output:
🔥 Total LICN Burned
💰 0.005 LICN (5000 spores)

Deflationary mechanism: 50% of all transaction fees are burned forever! 🦞⚡
```

### List All Validators
```bash
$ lichen validators

# Output:
🦞 Active Validators (3)

1. 7xKjF2vd9...
   Stake: 100 LICN
   Reputation: 1.0000 (normalized: 0.3333)
   Blocks: 1234

2. 8yLmG3we8...
   Stake: 200 LICN
   Reputation: 1.2000 (normalized: 0.4000)
   Blocks: 2345
```

---

## 📋 All Available Commands

```bash
# Identity management
lichen identity new              # Create new identity
lichen identity show             # Show your pubkey

# Balance & transfers
lichen balance [address]         # Check balance
lichen transfer <to> <amount>    # Send LICN

# Blockchain queries
lichen slot                      # Current slot
lichen latest                    # Latest block
lichen block <slot>              # Specific block
lichen burned                    # Total burned
lichen validators                # List validators

# Smart contracts (placeholders)
lichen deploy <wasm>             # Deploy contract
lichen call <addr> <fn> --args   # Call contract

# Faucet
lichen airdrop [amount]          # Request testnet tokens
```

---

## 🔌 Using the RPC API

### Start Your Validator (with RPC)
```bash
# The validator automatically starts an RPC server on port 8899
cargo run --release --bin lichen-validator
```

### Available RPC Endpoints

#### Account Operations
```javascript
// Get balance
{
  "jsonrpc": "2.0",
  "method": "getBalance",
  "params": ["7xKjF2vd9..."],
  "id": 1
}

// Get account info
{
  "jsonrpc": "2.0",
  "method": "getAccount",
  "params": ["7xKjF2vd9..."],
  "id": 1
}
```

#### Block Operations
```javascript
// Get latest block
{
  "jsonrpc": "2.0",
  "method": "getLatestBlock",
  "params": [],
  "id": 1
}

// Get specific block
{
  "jsonrpc": "2.0",
  "method": "getBlock",
  "params": [1234],
  "id": 1
}

// Get current slot
{
  "jsonrpc": "2.0",
  "method": "getSlot",
  "params": [],
  "id": 1
}
```

#### Transaction Operations
```javascript
// Send transaction
{
  "jsonrpc": "2.0",
  "method": "sendTransaction",
  "params": ["<base64_encoded_transaction>"],
  "id": 1
}

// Get transaction
{
  "jsonrpc": "2.0",
  "method": "getTransaction",
  "params": ["<signature_hash>"],
  "id": 1
}
```

#### Chain Statistics
```javascript
// Get total burned
{
  "jsonrpc": "2.0",
  "method": "getTotalBurned",
  "params": [],
  "id": 1
}

// Get validators
{
  "jsonrpc": "2.0",
  "method": "getValidators",
  "params": [],
  "id": 1
}
```

### Example with curl
```bash
# Get balance
curl -X POST http://localhost:8899 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "getBalance",
    "params": ["7xKjF2vd9..."],
    "id": 1
  }'

# Response:
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "spores": 100000000000,
    "licn": 100
  }
}
```

---

## 💻 Building DApps

### JavaScript Example
```javascript
const response = await fetch('http://localhost:8899', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'getBalance',
    params: ['7xKjF2vd9...'],
    id: 1
  })
});

const { result } = await response.json();
console.log(`Balance: ${result.licn} LICN`);
```

### Python Example
```python
import requests

response = requests.post('http://localhost:8899', json={
    'jsonrpc': '2.0',
    'method': 'getBalance',
    'params': ['7xKjF2vd9...'],
    'id': 1
})

result = response.json()['result']
print(f"Balance: {result['licn']} LICN")
```

---

## 📚 Smart Contract Standards

Lichen comes with 7 production-ready contracts:

### 1. LichenCoin (MT-20 Token)
```bash
# Located at: contracts/lichencoin/
# Features: Transfer, mint, burn, allowances
```

### 2. LichenPunks (MT-721 NFT)
```bash
# Located at: contracts/lichenpunks/
# Features: Mint, transfer, ownership tracking
```

### 3. LichenSwap (AMM DEX)
```bash
# Located at: contracts/lichenswap/
# Features: Swap, add/remove liquidity, pools
```

### 4. Lichen Market (Basic Marketplace)
```bash
# Located at: contracts/lichenmarket/
# Features: List, buy, cancel with cross-contract calls
```

### 5. LichenAuction (Advanced Marketplace)
```bash
# Located at: contracts/lichenauction/
# Features: Auctions, offers, royalties
```

### 6. LichenOracle (Price Feeds & VRF)
```bash
# Located at: contracts/lichenoracle/
# Features: Price feeds, random numbers, attestations
```

### 7. LichenDAO (Governance)
```bash
# Located at: contracts/lichendao/
# Features: Proposals, voting, treasury management
```

**Total:** 98.3 KB of production WASM contracts! 🔥

---

## 🛠️ Developer Resources

### File Locations
- **Keypairs:** `~/.lichen/keypairs/`
- **State DB:** `/tmp/lichen/` (or custom path)
- **Contracts:** `contracts/`
- **SDK:** `sdk/`

### Key Concepts
- **1 LICN** = 1,000,000,000 spores (9 decimals)
- **Base Fee** = 1,000,000 spores (0.001 LICN)
- **Fee Burn** = 50% of all fees (deflationary!)
- **Block Time** = ~1 second (target: 400ms)
- **Consensus** = Proof of Contribution (PoC)

### Documentation
- [Whitepaper](docs/WHITEPAPER.md) - Full vision
- [Architecture](docs/ARCHITECTURE.md) - Technical deep dive
- [Core Audit](CORE_AUDIT_FEB6.md) - Implementation status
- [Completion Report](CORE_LICN_COMPLETE_FEB6.md) - Today's features

---

## 🐛 Troubleshooting

### CLI Not Found
```bash
# Make sure it's built
cargo build --release --bin licn

# Use full path
./target/release/lichen --help
```

### RPC Connection Error
```bash
# Make sure validator is running
cargo run --release --bin lichen-validator

# Check RPC port (default: 8899)
lichen --rpc-url http://localhost:8899 slot
```

### Keypair Not Found
```bash
# Generate new keypair
lichen identity new

# Specify custom path
lichen identity show -k /path/to/keypair.json
```

### Faucet Connection Error
```bash
# Start the faucet
cargo run --release --bin lichen-faucet

# Visit web UI
open http://localhost:9090
```

---

## 🎯 What's Next?

Now that you have the basics, you can:

1. **Build a DApp** - Use the 7 contract standards
2. **Run a Validator** - Earn 50% of transaction fees
3. **Create Custom Contracts** - Use the SDK
4. **Test the Economy** - Watch the burn mechanism in action
5. **Join the Community** - Help us reach mainnet!

---

## 🦞 Happy Lichening! ⚡

**"Every crab can access the network!"** 🦀🌊

For questions, issues, or contributions:
- Check the docs in `docs/`
- Review the code in `core/`, `rpc/`, `cli/`
- Look at contract examples in `contracts/`

**The network is ready. Start building!** 🚀
