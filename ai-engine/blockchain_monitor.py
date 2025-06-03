import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
import websockets
from web3 import Web3
import redis

class BlockchainMonitor:
    """
    Real-time blockchain transaction monitoring system
    """
    
    def __init__(self, config: Dict = None):
        self.logger = logging.getLogger(__name__)
        self.config = config or self._default_config()
        self.is_monitoring = False
        self.callbacks = []
        self.redis_client = redis.Redis(
            host=self.config.get('redis_host', 'localhost'),
            port=self.config.get('redis_port', 6379),
            decode_responses=True
        )
        
        # Network connections
        self.network_connections = {}
        self.initialize_network_connections()
    
    def _default_config(self) -> Dict:
        return {
            'networks': {
                'hathor': {
                    'enabled': True,
                    'websocket_url': 'wss://node1.hathor.network/v1a/ws',
                    'rest_api': 'https://node1.hathor.network/v1a',
                    'poll_interval': 10
                },
                'ethereum': {
                    'enabled': False,
                    'websocket_url': 'wss://mainnet.infura.io/ws/v3/YOUR_KEY',
                    'rest_api': 'https://mainnet.infura.io/v3/YOUR_KEY',
                    'poll_interval': 12
                }
            },
            'monitoring': {
                'batch_size': 100,
                'max_retries': 3,
                'retry_delay': 5,
                'health_check_interval': 60
            },
            'filters': {
                'min_amount': 0,
                'max_amount': None,
                'exclude_addresses': [],
                'transaction_types': ['transfer', 'contract_call']
            }
        }
    
    def initialize_network_connections(self):
        """Initialize connections to different blockchain networks"""
        for network, config in self.config['networks'].items():
            if config['enabled']:
                self.network_connections[network] = {
                    'config': config,
                    'connection': None,
                    'last_block': 0,
                    'status': 'disconnected'
                }
    
    def add_callback(self, callback: Callable):
        """Add callback function for transaction processing"""
        self.callbacks.append(callback)
    
    async def start_monitoring(self):
        """Start monitoring all enabled networks"""
        self.logger.info("Starting blockchain monitoring...")
        self.is_monitoring = True
        
        # Start monitoring tasks for each network
        tasks = []
        for network in self.network_connections:
            if self.config['networks'][network]['enabled']:
                tasks.append(self._monitor_network(network))
        
        # Start health check task
        tasks.append(self._health_check_loop())
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            self.logger.error(f"Monitoring error: {e}")
            await self.stop_monitoring()
    
    async def stop_monitoring(self):
        """Stop monitoring all networks"""
        self.logger.info("Stopping blockchain monitoring...")
        self.is_monitoring = False
        
        # Close all network connections
        for network, conn_info in self.network_connections.items():
            if conn_info['connection']:
                try:
                    await conn_info['connection'].close()
                except:
                    pass
                conn_info['status'] = 'disconnected'
    
    async def _monitor_network(self, network: str):
        """Monitor specific blockchain network"""
        config = self.config['networks'][network]
        connection_info = self.network_connections[network]
        
        while self.is_monitoring:
            try:
                if network == 'hathor':
                    await self._monitor_hathor(connection_info)
                elif network == 'ethereum':
                    await self._monitor_ethereum(connection_info)
                
                await asyncio.sleep(config['poll_interval'])
                
            except Exception as e:
                self.logger.error(f"Error monitoring {network}: {e}")
                connection_info['status'] = 'error'
                await asyncio.sleep(config['poll_interval'] * 2)
    
    async def _monitor_hathor(self, connection_info: Dict):
        """Monitor Hathor network transactions"""
        config = connection_info['config']
        
        try:
            # Connect to Hathor WebSocket if not connected
            if not connection_info['connection']:
                connection_info['connection'] = await websockets.connect(
                    config['websocket_url']
                )
                connection_info['status'] = 'connected'
                self.logger.info("Connected to Hathor network")
            
            # Subscribe to new transactions
            subscribe_msg = {
                "type": "subscribe",
                "data": "new_transactions"
            }
            await connection_info['connection'].send(json.dumps(subscribe_msg))
            
            # Listen for new transactions
            async for message in connection_info['connection']:
                if not self.is_monitoring:
                    break
                
                try:
                    data = json.loads(message)
                    if data.get('type') == 'new_transaction':
                        await self._process_hathor_transaction(data['data'])
                        
                except json.JSONDecodeError:
                    self.logger.warning(f"Invalid JSON received: {message}")
                except Exception as e:
                    self.logger.error(f"Error processing Hathor transaction: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            self.logger.warning("Hathor WebSocket connection closed")
            connection_info['connection'] = None
            connection_info['status'] = 'disconnected'
        except Exception as e:
            self.logger.error(f"Hathor monitoring error: {e}")
            connection_info['status'] = 'error'
    
    async def _monitor_ethereum(self, connection_info: Dict):
        """Monitor Ethereum network transactions"""
        config = connection_info['config']
        
        try:
            # For Ethereum, we'll use HTTP polling instead of WebSocket
            # due to complexity of WebSocket subscription management
            async with aiohttp.ClientSession() as session:
                # Get latest block number
                latest_block = await self._get_ethereum_latest_block(session, config)
                
                if latest_block > connection_info['last_block']:
                    # Process new blocks
                    for block_num in range(connection_info['last_block'] + 1, latest_block + 1):
                        await self._process_ethereum_block(session, config, block_num)
                    
                    connection_info['last_block'] = latest_block
                    connection_info['status'] = 'connected'
        
        except Exception as e:
            self.logger.error(f"Ethereum monitoring error: {e}")
            connection_info['status'] = 'error'
    
    async def _process_hathor_transaction(self, tx_data: Dict):
        """Process Hathor transaction data"""
        try:
            # Extract transaction information
            transaction = {
                'tx_hash': tx_data.get('hash'),
                'network': 'hathor',
                'timestamp': tx_data.get('timestamp'),
                'inputs': tx_data.get('inputs', []),
                'outputs': tx_data.get('outputs', [])
            }
            
            # Process each output as a potential transaction
            for output in transaction['outputs']:
                if self._should_analyze_transaction(output):
                    analyzed_tx = {
                        'tx_hash': transaction['tx_hash'],
                        'amount': output.get('value', 0) / 100,  # Convert from cents
                        'sender': self._extract_sender(transaction['inputs']),
                        'receiver': output.get('script'),
                        'timestamp': transaction['timestamp'],
                        'network': 'hathor',
                        'tx_type': 'transfer',
                        'block_height': tx_data.get('height'),
                        'confirmations': 1
                    }
                    
                    # Send to fraud detection
                    await self._send_for_analysis(analyzed_tx)
        
        except Exception as e:
            self.logger.error(f"Error processing Hathor transaction: {e}")
    
    async def _process_ethereum_block(self, session: aiohttp.ClientSession, config: Dict, block_num: int):
        """Process Ethereum block transactions"""
        try:
            # Get block data
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_getBlockByNumber",
                "params": [hex(block_num), True],
                "id": 1
            }
            
            async with session.post(config['rest_api'], json=payload) as response:
                data = await response.json()
                block_data = data.get('result')
                
                if not block_data or not block_data.get('transactions'):
                    return
                
                # Process each transaction in the block
                for tx in block_data['transactions']:
                    if self._should_analyze_transaction(tx):
                        analyzed_tx = {
                            'tx_hash': tx['hash'],
                            'amount': int(tx.get('value', '0x0'), 16) / 1e18,  # Convert wei to ETH
                            'sender': tx['from'],
                            'receiver': tx['to'],
                            'timestamp': int(block_data['timestamp'], 16),
                            'network': 'ethereum',
                            'tx_type': 'transfer',
                            'gas_fee': int(tx.get('gasPrice', '0x0'), 16) * int(tx.get('gas', '0x0'), 16) / 1e18,
                            'block_height': block_num,
                            'confirmations': 1
                        }
                        
                        # Send to fraud detection
                        await self._send_for_analysis(analyzed_tx)
        
        except Exception as e:
            self.logger.error(f"Error processing Ethereum block {block_num}: {e}")
    
    async def _get_ethereum_latest_block(self, session: aiohttp.ClientSession, config: Dict) -> int:
        """Get latest Ethereum block number"""
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        }
        
        async with session.post(config['rest_api'], json=payload) as response:
            data = await response.json()
            return int(data['result'], 16)
    
    def _should_analyze_transaction(self, tx_data: Dict) -> bool:
        """Check if transaction should be analyzed"""
        filters = self.config['filters']
        
        # Check amount filters
        amount = tx_data.get('value', 0)
        if isinstance(amount, str):
            amount = int(amount, 16) if amount.startswith('0x') else float(amount)
        
        if amount < filters['min_amount']:
            return False
        
        if filters['max_amount'] and amount > filters['max_amount']:
            return False
        
        # Check address filters
        sender = tx_data.get('from') or self._extract_sender(tx_data.get('inputs', []))
        receiver = tx_data.get('to') or tx_data.get('script')
        
        if sender in filters['exclude_addresses'] or receiver in filters['exclude_addresses']:
            return False
        
        return True
    
    def _extract_sender(self, inputs: List[Dict]) -> str:
        """Extract sender address from transaction inputs"""
        if not inputs:
            return "unknown"
        
        # For Hathor, extract from first input
        first_input = inputs[0]
        return first_input.get('script') or first_input.get('address', "unknown")
    
    async def _send_for_analysis(self, transaction: Dict):
        """Send transaction to fraud detection system"""
        try:
            # Store transaction data in Redis for processing
            tx_key = f"pending_analysis:{transaction['tx_hash']}"
            self.redis_client.setex(tx_key, 300, json.dumps(transaction))  # 5 min TTL
            
            # Notify callbacks
            for callback in self.callbacks:
                try:
                    await callback(transaction)
                except Exception as e:
                    self.logger.error(f"Callback error: {e}")
            
            self.logger.debug(f"Transaction queued for analysis: {transaction['tx_hash']}")
        
        except Exception as e:
            self.logger.error(f"Error sending transaction for analysis: {e}")
    
    async def _health_check_loop(self):
        """Periodic health check for all network connections"""
        while self.is_monitoring:
            try:
                health_status = {}
                
                for network, conn_info in self.network_connections.items():
                    health_status[network] = {
                        'status': conn_info['status'],
                        'last_block': conn_info['last_block'],
                        'connected': conn_info['connection'] is not None
                    }
                
                # Store health status in Redis
                self.redis_client.setex(
                    'monitor_health',
                    120,  # 2 min TTL
                    json.dumps({
                        'timestamp': datetime.now().isoformat(),
                        'networks': health_status,
                        'monitoring_active': self.is_monitoring
                    })
                )
                
                self.logger.debug(f"Health check completed: {health_status}")
                
            except Exception as e:
                self.logger.error(f"Health check error: {e}")
            
            await asyncio.sleep(self.config['monitoring']['health_check_interval'])
    
    def get_monitoring_stats(self) -> Dict:
        """Get current monitoring statistics"""
        try:
            health_data = self.redis_client.get('monitor_health')
            if health_data:
                return json.loads(health_data)
            
            return {
                'monitoring_active': self.is_monitoring,
                'networks': {
                    network: {
                        'status': info['status'],
                        'last_block': info['last_block']
                    }
                    for network, info in self.network_connections.items()
                }
            }
        except Exception as e:
            self.logger.error(f"Error getting monitoring stats: {e}")
            return {'error': str(e)}