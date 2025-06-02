from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import asyncio
import logging
import redis
import json
from datetime import datetime
import numpy as np
import pandas as pd

from fraud_detector import FraudDetector
from blockchain_monitor import BlockchainMonitor
from data_models import TransactionData, FraudPrediction, AlertLevel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="HATHOR AI Guardian API",
    description="AI-powered fraud detection for blockchain networks",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
fraud_detector = FraudDetector()
blockchain_monitor = BlockchainMonitor()
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Load pre-trained model if available
try:
    fraud_detector.load_model("./models/fraud_model")
    logger.info("Pre-trained model loaded successfully")
except:
    logger.warning("No pre-trained model found. Training required.")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting HATHOR AI Guardian API...")
    # Start blockchain monitoring in background
    asyncio.create_task(blockchain_monitor.start_monitoring())

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down HATHOR AI Guardian API...")
    await blockchain_monitor.stop_monitoring()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "HATHOR AI Guardian API",
        "version": "1.0.0",
        "status": "active",
        "endpoints": {
            "fraud_detection": "/predict",
            "batch_analysis": "/batch-predict",
            "model_stats": "/model/stats",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": fraud_detector.is_trained,
        "redis_connected": redis_client.ping(),
        "services": {
            "fraud_detector": "active",
            "blockchain_monitor": "active"
        }
    }

@app.post("/predict", response_model=FraudPrediction)
async def predict_fraud(transaction: TransactionData):
    """Predict if a transaction is fraudulent"""
    try:
        # Convert to dict for processing
        tx_dict = transaction.dict()
        
        # Get prediction from fraud detector
        result = fraud_detector.predict(tx_dict)
        
        # Cache result in Redis
        cache_key = f"prediction:{transaction.tx_hash}"
        redis_client.setex(
            cache_key, 
            3600,  # 1 hour TTL
            json.dumps(result)
        )
        
        # Determine alert level
        if result['confidence'] > 0.8:
            alert_level = AlertLevel.HIGH
        elif result['confidence'] > 0.5:
            alert_level = AlertLevel.MEDIUM
        else:
            alert_level = AlertLevel.LOW
        
        return FraudPrediction(
            tx_hash=transaction.tx_hash,
            is_fraud=result['is_fraud'],
            confidence=result['confidence'],
            risk_score=result['risk_score'],
            alert_level=alert_level,
            model_predictions=result['models'],
            features_analyzed=result['features_used'],
            timestamp=result['timestamp']
        )
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-predict")
async def batch_predict(transactions: List[TransactionData]):
    """Batch prediction for multiple transactions"""
    try:
        results = []
        
        for tx in transactions:
            tx_dict = tx.dict()
            result = fraud_detector.predict(tx_dict)
            
            # Determine alert level
            if result['confidence'] > 0.8:
                alert_level = AlertLevel.HIGH
            elif result['confidence'] > 0.5:
                alert_level = AlertLevel.MEDIUM
            else:
                alert_level = AlertLevel.LOW
            
            prediction = FraudPrediction(
                tx_hash=tx.tx_hash,
                is_fraud=result['is_fraud'],
                confidence=result['confidence'],
                risk_score=result['risk_score'],
                alert_level=alert_level,
                model_predictions=result['models'],
                features_analyzed=result['features_used'],
                timestamp=result['timestamp']
            )
            results.append(prediction)
        
        return {
            "batch_id": f"batch_{datetime.now().timestamp()}",
            "total_transactions": len(transactions),
            "fraud_detected": sum(1 for r in results if r.is_fraud),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model/stats")
async def get_model_stats():
    """Get model statistics and feature importance"""
    try:
        if not fraud_detector.is_trained:
            raise HTTPException(status_code=400, detail="Model not trained")
        
        feature_importance = fraud_detector.get_feature_importance()
        
        # Get prediction statistics from Redis
        prediction_keys = redis_client.keys("prediction:*")
        recent_predictions = []
        
        for key in prediction_keys[-100:]:  # Last 100 predictions
            pred_data = redis_client.get(key)
            if pred_data:
                recent_predictions.append(json.loads(pred_data))
        
        fraud_count = sum(1 for p in recent_predictions if p.get('is_fraud'))
        
        return {
            "model_status": "trained",
            "feature_importance": feature_importance,
            "recent_stats": {
                "total_predictions": len(recent_predictions),
                "fraud_detected": fraud_count,
                "fraud_rate": fraud_count / len(recent_predictions) if recent_predictions else 0,
                "avg_confidence": np.mean([p.get('confidence', 0) for p in recent_predictions]) if recent_predictions else 0
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Model stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/model/retrain")
async def retrain_model(background_tasks: BackgroundTasks):
    """Trigger model retraining with new data"""
    try:
        # This would typically fetch new labeled data
        # For now, we'll simulate with cached predictions
        background_tasks.add_task(retrain_model_task)
        
        return {
            "message": "Model retraining started",
            "status": "in_progress",
            "estimated_time": "10-15 minutes"
        }
        
    except Exception as e:
        logger.error(f"Retrain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def retrain_model_task():
    """Background task for model retraining"""
    try:
        logger.info("Starting model retraining...")
        
        # Generate synthetic training data (in production, use real labeled data)
        np.random.seed(42)
        n_samples = 1000
        
        # Create synthetic features
        features = {
            'amount': np.random.exponential(100, n_samples),
            'hour': np.random.randint(0, 24, n_samples),
            'day_of_week': np.random.randint(0, 7, n_samples),
            'transaction_count_1h': np.random.poisson(5, n_samples),
            'transaction_count_24h': np.random.poisson(50, n_samples),
            'avg_amount_1h': np.random.exponential(50, n_samples),
            'avg_amount_24h': np.random.exponential(80, n_samples),
            'sender_risk_score': np.random.beta(2, 5, n_samples),
            'receiver_risk_score': np.random.beta(2, 5, n_samples),
            'network_congestion': np.random.beta(2, 2, n_samples)
        }
        
        training_data = pd.DataFrame(features)
        
        # Generate synthetic labels (10% fraud)
        labels = np.random.choice([0, 1], n_samples, p=[0.9, 0.1])
        
        # Retrain model
        results = fraud_detector.train(training_data, labels)
        
        # Save updated model
        fraud_detector.save_model("./models/fraud_model")
        
        logger.info("Model retraining completed successfully")
        
        # Cache training results
        redis_client.setex(
            "training_results",
            86400,  # 24 hours
            json.dumps(results, default=str)
        )
        
    except Exception as e:
        logger.error(f"Retraining task error: {e}")

@app.get("/alerts/recent")
async def get_recent_alerts():
    """Get recent fraud alerts"""
    try:
        # Get recent high-confidence fraud predictions
        prediction_keys = redis_client.keys("prediction:*")
        alerts = []
        
        for key in prediction_keys:
            pred_data = redis_client.get(key)
            if pred_data:
                prediction = json.loads(pred_data)
                if prediction.get('is_fraud') and prediction.get('confidence', 0) > 0.7:
                    alerts.append({
                        "tx_hash": key.split(":")[-1],
                        "confidence": prediction['confidence'],
                        "risk_score": prediction['risk_score'],
                        "timestamp": prediction['timestamp']
                    })
        
        # Sort by confidence (highest first)
        alerts.sort(key=lambda x: x['confidence'], reverse=True)
        
        return {
            "total_alerts": len(alerts),
            "high_risk_alerts": len([a for a in alerts if a['confidence'] > 0.9]),
            "alerts": alerts[:50]  # Return top 50 alerts
        }
        
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)