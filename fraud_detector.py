import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import logging
from typing import Dict, List, Tuple, Optional
import tensorflow as tf
from tensorflow import keras
from datetime import datetime, timedelta

class FraudDetector:
    """
    Advanced fraud detection system using ensemble methods and neural networks.
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.scaler = StandardScaler()
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.random_forest = RandomForestClassifier(n_estimators=100, random_state=42)
        self.neural_network = None
        self.is_trained = False
        self.feature_columns = [
            'amount', 'hour', 'day_of_week', 'transaction_count_1h',
            'transaction_count_24h', 'avg_amount_1h', 'avg_amount_24h',
            'sender_risk_score', 'receiver_risk_score', 'network_congestion'
        ]
        
        if model_path:
            self.load_model(model_path)
    
    def extract_features(self, transaction: Dict) -> Dict:
        """
        Extract features from transaction data for fraud detection.
        """
        features = {}
        
        # Basic transaction features
        features['amount'] = float(transaction.get('amount', 0))
        
        # Temporal features
        timestamp = transaction.get('timestamp', datetime.now().timestamp())
        dt = datetime.fromtimestamp(timestamp)
        features['hour'] = dt.hour
        features['day_of_week'] = dt.weekday()
        
        # Historical transaction patterns (would come from database in production)
        features['transaction_count_1h'] = transaction.get('tx_count_1h', 0)
        features['transaction_count_24h'] = transaction.get('tx_count_24h', 0)
        features['avg_amount_1h'] = transaction.get('avg_amount_1h', 0)
        features['avg_amount_24h'] = transaction.get('avg_amount_24h', 0)
        
        # Risk scores (would be calculated from address history)
        features['sender_risk_score'] = transaction.get('sender_risk', 0.0)
        features['receiver_risk_score'] = transaction.get('receiver_risk', 0.0)
        
        # Network features
        features['network_congestion'] = transaction.get('network_congestion', 0.5)
        
        return features
    
    def preprocess_data(self, data: pd.DataFrame) -> np.ndarray:
        """
        Preprocess transaction data for model input.
        """
        # Ensure all required columns exist
        for col in self.feature_columns:
            if col not in data.columns:
                data[col] = 0
        
        # Scale features
        X = data[self.feature_columns].values
        if not self.is_trained:
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)
        
        return X_scaled
    
    def build_neural_network(self, input_dim: int) -> keras.Model:
        """
        Build a neural network for fraud detection.
        """
        model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_shape=(input_dim,)),
            keras.layers.Dropout(0.3),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dropout(0.3),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        return model
    
    def train(self, training_data: pd.DataFrame, labels: np.ndarray) -> Dict:
        """
        Train the fraud detection models.
        """
        self.logger.info("Starting model training...")
        
        # Preprocess data
        X = self.preprocess_data(training_data)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, labels, test_size=0.2, random_state=42, stratify=labels
        )
        
        # Train Isolation Forest (unsupervised)
        self.isolation_forest.fit(X_train)
        
        # Train Random Forest
        self.random_forest.fit(X_train, y_train)
        
        # Train Neural Network
        self.neural_network = self.build_neural_network(X.shape[1])
        
        # Early stopping callback
        early_stopping = keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=10, restore_best_weights=True
        )
        
        history = self.neural_network.fit(
            X_train, y_train,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            callbacks=[early_stopping],
            verbose=1
        )
        
        # Evaluate models
        rf_pred = self.random_forest.predict(X_test)
        nn_pred = (self.neural_network.predict(X_test) > 0.5).astype(int)
        
        self.is_trained = True
        
        # Return training metrics
        results = {
            'random_forest_report': classification_report(y_test, rf_pred, output_dict=True),
            'neural_network_report': classification_report(y_test, nn_pred, output_dict=True),
            'training_history': history.history
        }
        
        self.logger.info("Model training completed successfully!")
        return results
    
    def predict(self, transaction: Dict) -> Dict:
        """
        Predict if a transaction is fraudulent.
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        # Extract features
        features = self.extract_features(transaction)
        
        # Convert to DataFrame and preprocess
        df = pd.DataFrame([features])
        X = self.preprocess_data(df)
        
        # Get predictions from all models
        isolation_pred = self.isolation_forest.predict(X)[0]  # -1 for anomaly, 1 for normal
        isolation_score = self.isolation_forest.score_samples(X)[0]
        
        rf_pred = self.random_forest.predict(X)[0]
        rf_proba = self.random_forest.predict_proba(X)[0][1]  # Probability of fraud
        
        nn_pred = self.neural_network.predict(X)[0][0]
        
        # Ensemble prediction
        fraud_indicators = [
            isolation_pred == -1,  # Isolation forest detects anomaly
            rf_pred == 1,          # Random forest predicts fraud
            nn_pred > 0.5          # Neural network predicts fraud
        ]
        
        fraud_count = sum(fraud_indicators)
        ensemble_confidence = (fraud_count / 3) * max(rf_proba, nn_pred)
        
        # Determine final prediction
        is_fraud = fraud_count >= 2 or ensemble_confidence > 0.7
        
        return {
            'is_fraud': bool(is_fraud),
            'confidence': float(ensemble_confidence),
            'risk_score': float(max(rf_proba, nn_pred)),
            'models': {
                'isolation_forest': {
                    'prediction': 'anomaly' if isolation_pred == -1 else 'normal',
                    'score': float(isolation_score)
                },
                'random_forest': {
                    'prediction': bool(rf_pred),
                    'probability': float(rf_proba)
                },
                'neural_network': {
                    'prediction': bool(nn_pred > 0.5),
                    'probability': float(nn_pred)
                }
            },
            'features_used': features,
            'timestamp': datetime.now().isoformat()
        }
    
    def save_model(self, filepath: str):
        """
        Save the trained model to disk.
        """
        if not self.is_trained:
            raise ValueError("No trained model to save")
        
        model_data = {
            'scaler': self.scaler,
            'isolation_forest': self.isolation_forest,
            'random_forest': self.random_forest,
            'feature_columns': self.feature_columns,
            'is_trained': self.is_trained
        }
        
        # Save traditional ML models
        joblib.dump(model_data, f"{filepath}_ml.pkl")
        
        # Save neural network separately
        self.neural_network.save(f"{filepath}_nn.h5")
        
        self.logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """
        Load a trained model from disk.
        """
        try:
            # Load traditional ML models
            model_data = joblib.load(f"{filepath}_ml.pkl")
            
            self.scaler = model_data['scaler']
            self.isolation_forest = model_data['isolation_forest']
            self.random_forest = model_data['random_forest']
            self.feature_columns = model_data['feature_columns']
            self.is_trained = model_data['is_trained']
            
            # Load neural network
            self.neural_network = keras.models.load_model(f"{filepath}_nn.h5")
            
            self.logger.info(f"Model loaded from {filepath}")
            
        except Exception as e:
            self.logger.error(f"Failed to load model: {e}")
            raise
    
    def get_feature_importance(self) -> Dict:
        """
        Get feature importance from the random forest model.
        """
        if not self.is_trained:
            raise ValueError("Model must be trained first")
        
        importance = self.random_forest.feature_importances_
        feature_importance = dict(zip(self.feature_columns, importance))
        
        # Sort by importance
        sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        
        return {
            'feature_importance': dict(sorted_features),
            'top_features': [f[0] for f in sorted_features[:5]]
        }
    
    def retrain_with_feedback(self, new_data: pd.DataFrame, new_labels: np.ndarray):
        """
        Retrain the model with new feedback data.
        """
        self.logger.info("Retraining model with new feedback data...")
        
        # This would typically involve incremental learning
        # For now, we'll retrain the entire model
        return self.train(new_data, new_labels)