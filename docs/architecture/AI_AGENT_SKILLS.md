# 🤖 Lichen AI Agent Skills & Automation

## Overview

Lichen is built **BY Agents FOR Agents**. Every lichen (AI agent) needs skills to interact with the blockchain autonomously. This document provides agent-native features, CLI tools, and automation scripts.

## Quick Start for Agents

### 1. Install Lichen SDK

```bash
# Install CLI tools
curl -sSfL https://get.lichen.network | sh

# Or via npm
npm install -g @lichen/cli

# Or via pip
pip install lichen-sdk
```

### 2. Generate Agent Identity

Every agent needs a Lichen ID:

```bash
# Generate new identity
lichen identity new --save ~/.lichen/agent-id.json

# Or programmatically
lichen identity generate --format json > agent-id.json
```

### 3. Get Testnet LICN

```bash
# Request from faucet
lichen airdrop 100 --address $(lichen identity address)

# Or via API
curl -X POST http://localhost:9090/api/request \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS","amount":100}'
```

## AI Agent API Reference

### JavaScript/Node.js SDK

```javascript
const { Lichen, Keypair } = require('@lichen/sdk');

// Initialize client
const client = new Lichen('http://localhost:8899');

// Create agent identity
const agent = Keypair.generate();

// Check balance
const balance = await client.getBalance(agent.publicKey);

// Send transaction
const tx = await client.transfer({
  from: agent,
  to: 'RECIPIENT_ADDRESS',
  amount: 1.5 // LICN
});

// Deploy contract
const program = await client.deployProgram({
  deployer: agent,
  wasmPath: './my_contract.wasm',
  name: 'MyContract'
});

// Call contract function
const result = await client.callProgram({
  programAddress: program.address,
  function: 'initialize',
  args: ['param1', 'param2'],
  signer: agent
});
```

### Python SDK

```python
from lichen import Lichen, Keypair

# Initialize
client = Lichen('http://localhost:8899')

# Agent identity
agent = Keypair.generate()

# Get balance
balance = client.get_balance(agent.public_key)

# Send LICN
tx = client.transfer(
    from_keypair=agent,
    to='RECIPIENT_ADDRESS',
    amount=1.5
)

# Deploy contract
program = client.deploy_program(
    deployer=agent,
    wasm_path='./my_contract.wasm',
    name='MyContract'
)

# Interact
result = client.call_program(
    program_address=program.address,
    function='initialize',
    args=['param1', 'param2'],
    signer=agent
)
```

### Rust SDK

```rust
use lichen_sdk::{Client, Keypair};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize
    let client = Client::new("http://localhost:8899")?;
    
    // Agent identity
    let agent = Keypair::new();
    
    // Get balance
    let balance = client.get_balance(&agent.pubkey()).await?;
    
    // Send transaction
    let tx = client.transfer(
        &agent,
        &recipient_pubkey,
        1_500_000_000 // in spores (1.5 LICN)
    ).await?;
    
    // Deploy program
    let program = client.deploy_program(
        &agent,
        include_bytes!("my_contract.wasm"),
        "MyContract"
    ).await?;
    
    Ok(())
}
```

## Automation Scripts

### Batch Transfer Script

```python
# batch_transfer.py
from lichen import Lichen, Keypair
import json

client = Lichen('http://localhost:8899')
agent = Keypair.from_file('agent-id.json')

# Load recipients
with open('recipients.json') as f:
    recipients = json.load(f)

# Send to all
for recipient in recipients:
    tx = client.transfer(
        from_keypair=agent,
        to=recipient['address'],
        amount=recipient['amount']
    )
    print(f"✅ Sent {recipient['amount']} LICN to {recipient['address']}")
    print(f"   TX: {tx.signature}")
```

### Automated Contract Deployment

```javascript
// auto_deploy.js
const { Lichen, Keypair } = require('@lichen/sdk');
const fs = require('fs');

async function deployAll() {
    const client = new Lichen('http://localhost:8899');
    const agent = Keypair.fromFile('./agent-id.json');
    
    // Get all WASM files
    const contracts = fs.readdirSync('./contracts')
        .filter(f => f.endsWith('.wasm'));
    
    for (const contract of contracts) {
        console.log(`Deploying ${contract}...`);
        
        const program = await client.deployProgram({
            deployer: agent,
            wasmPath: `./contracts/${contract}`,
            name: contract.replace('.wasm', '')
        });
        
        console.log(`✅ Deployed: ${program.address}`);
        
        // Save deployment info
        fs.writeFileSync(
            `./deployments/${contract}.json`,
            JSON.stringify({
                name: contract,
                address: program.address,
                deployedAt: Date.now()
            })
        );
    }
}

deployAll();
```

### Monitoring Agent

```python
# monitor_agent.py
from lichen import Lichen
import time

client = Lichen('http://localhost:8899')

def monitor():
    last_block = 0
    
    while True:
        # Get latest block
        block = client.get_latest_block()
        
        if block.slot > last_block:
            print(f"🔔 New Block: {block.slot}")
            print(f"   Transactions: {len(block.transactions)}")
            print(f"   Validator: {block.validator}")
            
            # Check for specific transactions
            for tx in block.transactions:
                if 'MyContract' in tx.program:
                    print(f"   ⚡ Contract interaction: {tx.signature}")
            
            last_block = block.slot
        
        time.sleep(0.4)  # 400ms block time

if __name__ == '__main__':
    monitor()
```

## Agent CLI Commands

### Identity Management

```bash
# Generate new identity
lichen identity new

# Show current identity
lichen identity show

# Export identity (for backup)
lichen identity export --output backup.json

# Import identity
lichen identity import backup.json
```

### Balance & Transfers

```bash
# Check balance
lichen balance

# Send LICN
lichen transfer --to ADDRESS --amount 10.5

# Batch transfer from CSV
lichen transfer --batch recipients.csv
```

### Contract Operations

```bash
# Deploy contract
lichen deploy ./my_contract.wasm --name MyContract

# Call contract function
lichen call CONTRACT_ADDRESS initialize --args '["param1"]'

# Query contract state
lichen query CONTRACT_ADDRESS get_state

# List deployed contracts
lichen programs list
```

### Automation & Monitoring

```bash
# Start monitoring
lichen monitor --watch-address CONTRACT_ADDRESS

# Auto-execute on events
lichen watch --contract ADDRESS --event Transfer --exec "./notify.sh"

# Scheduled transactions
lichen schedule transfer --to ADDRESS --amount 1 --cron "0 * * * *"
```

## Agent-Native Features

### 1. Lichen ID (Agent Identity)

Every agent gets a persistent identity:

```rust
#[derive(Account)]
pub struct LichenIdentity {
    pub pubkey: Pubkey,
    pub agent_type: AgentType,  // GPT, Claude, Custom, etc.
    pub capabilities: Vec<String>,
    pub reputation: u64,
    pub created_at: i64,
}
```

### 2. Multi-Signature for Agent Teams

Agents can work together:

```javascript
const multisig = await client.createMultisig({
    agents: [agent1.publicKey, agent2.publicKey, agent3.publicKey],
    threshold: 2  // Need 2/3 signatures
});

// Execute with multisig
await client.executeMultisig({
    multisig: multisig.address,
    transaction: someTx,
    signers: [agent1, agent2]
});
```

### 3. Automated Execution

Agents can schedule recurring tasks:

```python
# Schedule recurring payment
client.schedule_transaction(
    from_keypair=agent,
    to='RECIPIENT',
    amount=10,
    frequency='daily',
    start_date='2026-02-10'
)
```

### 4. Gas-less Meta-Transactions

Agents can sponsor transactions for users:

```javascript
// Agent pays for user's transaction
await client.metaTransaction({
    sponsor: agent,
    userTransaction: tx,
    maxGas: 0.01  // LICN
});
```

## Environment Variables

```bash
# RPC endpoint
export LICHEN_RPC_URL="http://localhost:8899"

# Agent identity file
export LICHEN_IDENTITY="~/.lichen/agent-id.json"

# Network (testnet/mainnet)
export LICHEN_NETWORK="testnet"

# Enable debug logs
export LICHEN_DEBUG=true
```

## Best Practices for AI Agents

### 1. Error Handling

```python
from lichen import Lichen, LichenError

try:
    tx = client.transfer(agent, to, amount)
except LichenError as e:
    if e.code == 'INSUFFICIENT_BALANCE':
        # Request from faucet
        client.request_airdrop(agent.public_key, 100)
        # Retry
        tx = client.transfer(agent, to, amount)
    else:
        raise
```

### 2. Rate Limiting

```javascript
const Bottleneck = require('bottleneck');

// Limit to 10 requests per second
const limiter = new Bottleneck({
    reservoir: 10,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 1000
});

// Wrap calls
const transfer = limiter.wrap(async (to, amount) => {
    return await client.transfer({ from: agent, to, amount });
});
```

### 3. Transaction Batching

```rust
// Batch multiple operations
let batch = client.batch_builder()
    .add_transfer(&agent, &recipient1, 1_000_000_000)
    .add_transfer(&agent, &recipient2, 2_000_000_000)
    .add_call_program(&program, "update", vec![])
    .build()?;

let result = client.execute_batch(&agent, batch).await?;
```

### 4. State Caching

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def get_contract_state(address):
    return client.get_program_account(address)

# Cache invalidation
def clear_cache_on_update():
    get_contract_state.cache_clear()
```

## Example: Trading Agent

```python
# trading_agent.py
from lichen import Lichen, Keypair
import time

class TradingAgent:
    def __init__(self, identity_path):
        self.client = Lichen('http://localhost:8899')
        self.agent = Keypair.from_file(identity_path)
    
    def monitor_price(self, token_address):
        while True:
            price = self.client.get_token_price(token_address)
            
            if price < self.buy_threshold:
                self.execute_buy(token_address, 10)
            elif price > self.sell_threshold:
                self.execute_sell(token_address, 10)
            
            time.sleep(1)
    
    def execute_buy(self, token, amount):
        print(f"🟢 Buying {amount} {token}")
        tx = self.client.swap(
            from_keypair=self.agent,
            from_token='LICN',
            to_token=token,
            amount=amount
        )
        print(f"   TX: {tx.signature}")
    
    def execute_sell(self, token, amount):
        print(f"🔴 Selling {amount} {token}")
        tx = self.client.swap(
            from_keypair=self.agent,
            from_token=token,
            to_token='LICN',
            amount=amount
        )
        print(f"   TX: {tx.signature}")

if __name__ == '__main__':
    agent = TradingAgent('./agent-id.json')
    agent.buy_threshold = 0.10
    agent.sell_threshold = 0.15
    agent.monitor_price('TOKEN_ADDRESS')
```

## Resources

- **API Docs**: http://localhost:3000/docs
- **SDK Examples**: https://github.com/lichen/examples
- **Agent Playground**: http://localhost:3000/playground
- **Discord**: Join #ai-agents channel

---

**Built for symbionts, by symbionts** 🦞⚡
