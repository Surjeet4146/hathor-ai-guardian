import asyncio
import aiohttp
import json
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
import websockets
from web3 import Web3
import redis
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class BlockchainConfig:
    name: str
    rpc_url: str
    ws_url: Optional[str] = None
    api_key: Optional[str] = None
    block_time: int = 30  # seconds
    confirmations_required: int = 6

class BlockchainMonitor:
    """
    Monitor multiple blockchain networks for transactions and network health.
    """

    def __init__(self):
        self.logger = logger
        self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
        self.is_monitoring = False
        self.callbacks: List[Callable] = []
        
        # Blockchain configurations
        self.networks = {
            'hathor': BlockchainConfig(
                name='hathor',
                rpc_url='https://node1.mainnet.hathor.network/v1a/',
                ws_url='wss://node1.mainnet.hathor.network/v1a/ws/',
                block_time=15
            ),
            'ethereum': BlockchainConfig(
                name='ethereum',
                rpc_url='https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY',
                ws_url='wss://eth-mainnet.ws.alchemyapi.io/v2/YOUR_API_KEY',
                block_time=12,
                confirmations_required=12
            ),
            'polygon': BlockchainConfig(
                name='polygon',
                rpc_url='https://polygon-mainnet.alchemyapi.io/v2/YOUR_API_KEY',
                ws_url='wss://polygon-mainnet.ws.alchemyapi.io/v2/YOUR_API_KEY',
                block_time=2,
                confirmations_required=20
            )
        }

        # Initialize Web3 connections
        self.web3_connections = {}
        self._init_web3_connections()

    def _init_web3_connections(self):
        """Initialize Web3 connections for Ethereum-like networks."""
        try:
            for network_name, config in self.networks.items():
                if network_name in ['ethereum', 'polygon']:
                    try:
                        w3 = Web3(Web3.HTTPProvider(config.rpc_url))
                        if w3.is_connected():
                            self.web3_connections[network_name] = w3
                            self.logger.info(f"Connected to {network_name} network")
                        else:
                            self.logger.warning(f"Failed to connect to {network_name}")
                    except Exception as e:
                        self.logger.error(f"Error connecting to {network_name}: {e}")
        except Exception as e:
            self.logger.error(f"Error initializing Web3 connections: {e}")

    def add_callback(self, callback: Callable):
        """Add callback function for transaction events."""
        self.callbacks.append(callback)

    async def start_monitoring(self):
        """Start monitoring all configured networks."""
        if self.is_monitoring:
            self.logger.warning("Monitoring already started")
            return

        self.is_monitoring = True
        self.logger.info("Starting blockchain monitoring...")

        # Start monitoring tasks for each network
        tasks = []
        for network_name in self.networks.keys():
            if network_name == 'hathor':
                tasks.append(asyncio.create_task(self._monitor_hathor()))
            elif network_name in self.web3_connections:
                tasks.append(asyncio.create_task(self._monitor_web3_network(network_name)))

        # Start network health monitoring
        tasks.append(asyncio.create_task(self._monitor_network_health()))

        # Wait for all tasks
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            self.logger.error(f"Monitoring error: {e}")
            self.is_monitoring = False

    async def stop_monitoring(self):
        """Stop monitoring all networks."""
        self.logger.info("Stopping blockchain monitoring...")
        self.is_monitoring = False

    async def _monitor_hathor(self):
        """Monitor Hathor network for new transactions."""
        config = self.networks['hathor']
        
        while self.is_monitoring:
            try:
                # Get latest transactions from Hathor API
                async with aiohttp.ClientSession() as session:
                    # Get recent transactions
                    async with session.get(f"{config.rpc_url}transaction") as response:
                        if response.status == 200:
                            data = await response.json()
                            transactions = data.get('transactions', [])
                            
                            for tx_data in transactions[:10]:  # Process last 10 transactions
                                await self._process_hathor_transaction(tx_data)

                    # Get network status
                    async with session.get(f"{config.rpc_url}status") as response:
                        if response.status == 200:
                            status_data = await response.json()
                            await self._update_network_health('hathor', status_data)

            except Exception as e:
                self.logger.error(f"Hathor monitoring error: {e}")

            await asyncio.sleep(config.block_time)

    async def _monitor_web3_network(self, network_name: str):
        """Monitor Web3-compatible networks (Ethereum, Polygon)."""
        config = self.networks[network_name]
        w3 = self.web3_connections[network_name]
        last_block = None

        while self.is_monitoring:
            try:
                current_block = w3.eth.block_number
                
                if last_block is None:
                    last_block = current_block - 1

                # Process new blocks
                for block_num in range(last_block + 1, current_block + 1):
                    try:
                        block = w3.eth.get_block(block_num, full_transactions=True)
                        await self._process_web3_block(network_name, block)
                    except Exception as e:
                        self.logger.error(f"Error processing block {block_num} on {network_name}: {e}")

                last_block = current_block

                # Update network health
                await self._update_web3_network_health(network_name, w3)

            except Exception as e:
                self.logger.error(f"{network_name} monitoring error: {e}")

            await asyncio.sleep(config.block_time)

    async def _process_hathor_transaction(self, tx_data: Dict):
        """Process a Hathor transaction."""
        try:
            # Extract transaction information
            tx_hash = tx_data.get('hash')
            timestamp = tx_data.get('timestamp', datetime.now().timestamp())
            
            # Process inputs and outputs
            inputs = tx_data.get('inputs', [])
            outputs = tx_data.get('outputs', [])
            
            for output in outputs:
                if output.get('value', 0) > 0:
                    transaction = {
                        'tx_hash': tx_hash,
                        'amount': output['value'] / 100,  # Convert from cents
                        'sender': inputs[0].get('address', '') if inputs else '',
                        'receiver': output.get('address', ''),
                        'timestamp': timestamp,
                        'network': 'hathor',
                        'tx_type': 'transfer',
                        'block_height': tx_data.get('height'),
                        'confirmations': tx_data.get('confirmations', 0)
                    }

                    # Add to processing queue
                    await self._queue_transaction_for_analysis(transaction)

        except Exception as e:
            self.logger.error(f"Error processing Hathor transaction: {e}")

    async def _process_web3_block(self, network_name: str, block):
        """Process a Web3 block and its transactions."""
        try:
            for tx in block.transactions:
                if tx.value > 0:  # Only process transactions with value
                    transaction = {
                        'tx_hash': tx.hash.hex(),
                        'amount': Web3.from_wei(tx.value, 'ether'),
                        'sender': tx['from'],
                        'receiver': tx.to,
                        'timestamp': block.timestamp,
                        'network': network_name,
                        'tx_type': 'transfer',
                        'gas_fee': Web3.from_wei(tx.gas * tx.gasPrice, 'ether'),
                        'block_height': block.number,
                        'confirmations': 0  # Will be updated later
                    }

                    # Add to processing queue
                    await self._queue_transaction_for_analysis(transaction)

        except Exception as e:
            self.logger.error(f"Error processing {network_name} block: {e}")

    async def _queue_transaction_for_analysis(self, transaction: Dict):
        """Queue transaction for fraud analysis."""
        try:
            # Store in Redis for processing
            queue_key = f"tx_queue:{transaction['network']}"
            tx_json = json.dumps(transaction, default=str)
            
            self.redis_client.lpush(queue_key, tx_json)
            self.redis_client.expire(queue_key, 3600)  # 1 hour TTL

            # Call callbacks
            for callback in self.callbacks:
                try:
                    await callback(transaction)
                except Exception as e:
                    self.logger.error(f"Callback error: {e}")

            self.logger.debug(f"Queued transaction for analysis: {transaction['tx_hash']}")

        except Exception as e:
            self.logger.error(f"Error queuing transaction: {e}")

    async def _update_network_health(self, network_name: str, status_data: Dict):
        """Update network health metrics."""
        try:
            health_data = {
                'network': network_name,
                'block_height': status_data.get('height', 0),
                'avg_block_time': status_data.get('avg_block_time', 0),
                'pending_transactions': status_data.get('pending_tx', 0),
                'congestion_level': min(status_data.get('pending_tx', 0) / 1000, 1.0),
                'timestamp': datetime.now().isoformat()
            }

            # Store in Redis
            health_key = f"network_health:{network_name}"
            self.redis_client.setex(health_key, 300, json.dumps(health_data))  # 5 min TTL

        except Exception as e:
            self.logger.error(f"Error updating network health for {network_name}: {e}")

    async def _update_web3_network_health(self, network_name: str, w3: Web3):
        """Update Web3 network health metrics."""
        try:
            latest_block = w3.eth.get_block('latest')
            pending_block = w3.eth.get_block('pending')
            
            health_data = {
                'network': network_name,
                'block_height': latest_block.number,
                'avg_block_time': 12 if network_name == 'ethereum' else 2,  # Approximate
                'pending_transactions': len(pending_block.transactions),
                'congestion_level': min(len(pending_block.transactions) / 200, 1.0),
                'timestamp': datetime.now().isoformat()
            }

            # Store in Redis
            health_key = f"network_health:{network_name}"
            self.redis_client.setex(health_key, 300, json.dumps(health_data))  # 5 min TTL

        except Exception as e:
            self.logger.error(f"Error updating {network_name} health: {e}")

    async def _monitor_network_health(self):
        """Monitor overall network health and performance."""
        while self.is_monitoring:
            try:
                # Check Redis connection
                redis_healthy = self.redis_client.ping()

                # Check Web3 connections
                web3_status = {}
                for network_name, w3 in self.web3_connections.items():
                    try:
                        web3_status[network_name] = w3.is_connected()
                    except:
                        web3_status[network_name] = False

                # Store overall system health
                system_health = {
                    'timestamp': datetime.now().isoformat(),
                    'redis_healthy': redis_healthy,
                    'web3_connections': web3_status,
                    'monitoring_active': self.is_monitoring
                }

                self.redis_client.setex('system_health', 60, json.dumps(system_health))

            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")

            await asyncio.sleep(30)  # Check every 30 seconds

    def get_network_health(self, network_name: str) -> Optional[Dict]:
        """Get current network health data."""
        try:
            health_key = f"network_health:{network_name}"
            health_data = self.redis_client.get(health_key)
            
            if health_data:
                return json.loads(health_data)
            return None

        except Exception as e:
            self.logger.error(f"Error getting network health: {e}")
            return None

    def get_queued_transactions(self, network_name: str, limit: int = 10) -> List[Dict]:
        """Get queued transactions for processing."""
        try:
            queue_key = f"tx_queue:{network_name}"
            tx_list = self.redis_client.lrange(queue_key, 0, limit - 1)
            
            transactions = []
            for tx_json in tx_list:
                try:
                    transactions.append(json.loads(tx_json))
                except:
                    continue

            return transactions

        except Exception as e:
            self.logger.error(f"Error getting queued transactions: {e}")
            return []

    def remove_processed_transaction(self, network_name: str, tx_hash: str):
        """Remove processed transaction from queue."""
        try:
            queue_key = f"tx_queue:{network_name}"
            tx_list = self.redis_client.lrange(queue_key, 0, -1)
            
            for tx_json in tx_list:
                try:
                    tx_data = json.loads(tx_json)
                    if tx_data.get('tx_hash') == tx_hash:
                        self.redis_client.lrem(queue_key, 1, tx_json)
                        break
                except:
                    continue

        except Exception as e:
            self.logger.error(f"Error removing processed transaction: {e}")