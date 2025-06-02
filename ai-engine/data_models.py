from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

class AlertLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TransactionType(str, Enum):
    TRANSFER = "transfer"
    CONTRACT_CALL = "contract_call"
    TOKEN_MINT = "token_mint"
    TOKEN_BURN = "token_burn"
    SWAP = "swap"

class NetworkType(str, Enum):
    HATHOR = "hathor"
    ETHEREUM = "ethereum"
    BITCOIN = "bitcoin"
    POLYGON = "polygon"

class TransactionData(BaseModel):
    tx_hash: str = Field(..., description="Transaction hash")
    amount: float = Field(..., description="Transaction amount")
    sender: str = Field(..., description="Sender address")
    receiver: str = Field(..., description="Receiver address")
    timestamp: Optional[float] = Field(default=None, description="Transaction timestamp")
    network: NetworkType = Field(default=NetworkType.HATHOR, description="Blockchain network")
    tx_type: TransactionType = Field(default=TransactionType.TRANSFER, description="Transaction type")
    gas_fee: Optional[float] = Field(default=0.0, description="Gas fee paid")
    block_height: Optional[int] = Field(default=None, description="Block height")
    confirmations: Optional[int] = Field(default=0, description="Number of confirmations")
    
    # Additional context data
    sender_risk: Optional[float] = Field(default=0.0, description="Sender risk score")
    receiver_risk: Optional[float] = Field(default=0.0, description="Receiver risk score")
    tx_count_1h: Optional[int] = Field(default=0, description="Transactions in last hour")
    tx_count_24h: Optional[int] = Field(default=0, description="Transactions in last 24 hours")
    avg_amount_1h: Optional[float] = Field(default=0.0, description="Average amount last hour")
    avg_amount_24h: Optional[float] = Field(default=0.0, description="Average amount last 24 hours")
    network_congestion: Optional[float] = Field(default=0.5, description="Network congestion level")

class ModelPrediction(BaseModel):
    prediction: bool = Field(..., description="Model prediction result")
    probability: Optional[float] = Field(default=None, description="Prediction probability")
    score: Optional[float] = Field(default=None, description="Model-specific score")

class FraudPrediction(BaseModel):
    tx_hash: str = Field(..., description="Transaction hash")
    is_fraud: bool = Field(..., description="Fraud prediction result")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Overall risk score")
    alert_level: AlertLevel = Field(..., description="Alert severity level")
    
    model_predictions: Dict[str, ModelPrediction] = Field(..., description="Individual model predictions")
    features_analyzed: Dict[str, Any] = Field(..., description="Features used in analysis")
    timestamp: str = Field(..., description="Prediction timestamp")
    
    processing_time_ms: Optional[float] = Field(default=None, description="Processing time in milliseconds")

class BatchPredictionRequest(BaseModel):
    transactions: List[TransactionData] = Field(..., description="List of transactions to analyze")
    batch_id: Optional[str] = Field(default=None, description="Batch identifier")

class BatchPredictionResponse(BaseModel):
    batch_id: str = Field(..., description="Batch identifier")
    total_transactions: int = Field(..., description="Total number of transactions")
    fraud_detected: int = Field(..., description="Number of fraudulent transactions detected")
    processing_time_ms: float = Field(..., description="Total processing time")
    results: List[FraudPrediction] = Field(..., description="Individual prediction results")

class ModelStats(BaseModel):
    model_version: str = Field(..., description="Model version")
    training_date: str = Field(..., description="Last training date")
    total_predictions: int = Field(..., description="Total predictions made")
    fraud_detection_rate: float = Field(..., description="Fraud detection rate")
    false_positive_rate: Optional[float] = Field(default=None, description="False positive rate")
    accuracy: Optional[float] = Field(default=None, description="Model accuracy")
    
    feature_importance: Dict[str, float] = Field(..., description="Feature importance scores")
    top_features: List[str] = Field(..., description="Most important features")

class AlertData(BaseModel):
    alert_id: str = Field(..., description="Alert identifier")
    tx_hash: str = Field(..., description="Associated transaction hash")
    alert_level: AlertLevel = Field(..., description="Alert severity")
    confidence: float = Field(..., description="Detection confidence")
    risk_factors: List[str] = Field(..., description="Identified risk factors")
    timestamp: str = Field(..., description="Alert timestamp")
    status: str = Field(default="active", description="Alert status")

class NetworkHealth(BaseModel):
    network: NetworkType = Field(..., description="Network identifier")
    block_height: int = Field(..., description="Current block height")
    avg_block_time: float = Field(..., description="Average block time in seconds")
    pending_transactions: int = Field(..., description="Pending transactions count")
    network_hashrate: Optional[float] = Field(default=None, description="Network hashrate")
    congestion_level: float = Field(..., ge=0.0, le=1.0, description="Network congestion level")
    timestamp: str = Field(..., description="Health check timestamp")

class AddressProfile(BaseModel):
    address: str = Field(..., description="Blockchain address")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Address risk score")
    transaction_count: int = Field(..., description="Total transaction count")
    total_volume: float = Field(..., description="Total transaction volume")
    first_seen: str = Field(..., description="First transaction timestamp")
    last_seen: str = Field(..., description="Last transaction timestamp")
    
    risk_factors: List[str] = Field(default=[], description="Identified risk factors")
    is_exchange: bool = Field(default=False, description="Known exchange address")
    is_mixer: bool = Field(default=False, description="Known mixer address")
    reputation_score: Optional[float] = Field(default=None, description="Reputation score")

class TrainingData(BaseModel):
    features: Dict[str, List[float]] = Field(..., description="Training features")
    labels: List[int] = Field(..., description="Training labels")
    sample_count: int = Field(..., description="Number of samples")
    fraud_ratio: float = Field(..., description="Ratio of fraudulent samples")

class ModelRetrainRequest(BaseModel):
    training_data: Optional[TrainingData] = Field(default=None, description="New training data")
    retrain_type: str = Field(default="full", description="Retraining type: full or incremental")
    save_model: bool = Field(default=True, description="Save model after training")

class SystemConfig(BaseModel):
    fraud_threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Fraud detection threshold")
    alert_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Alert generation threshold")
    batch_size: int = Field(default=32, description="Processing batch size")
    cache_ttl: int = Field(default=3600, description="Cache TTL in seconds")
    
    model_settings: Dict[str, Any] = Field(default={}, description="Model-specific settings")
    monitoring_enabled: bool = Field(default=True, description="Enable monitoring")
    auto_retrain: bool = Field(default=False, description="Enable automatic retraining")

class APIResponse(BaseModel):
    success: bool = Field(..., description="Request success status")
    message: str = Field(..., description="Response message")
    data: Optional[Any] = Field(default=None, description="Response data")
    error: Optional[str] = Field(default=None, description="Error message if any")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="Response timestamp")