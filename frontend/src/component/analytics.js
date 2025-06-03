export const formatRiskDistribution = (data) => {
  if (!data) return [];

  return [
    { label: 'High Risk', value: data.high_risk || 0, color: '#FF4C4C' },
    { label: 'Medium Risk', value: data.medium_risk || 0, color: '#FFA500' },
    { label: 'Low Risk', value: data.low_risk || 0, color: '#4CAF50' },
  ];
};

export const getAnalyticsSummaryText = (data) => {
  if (!data) return 'No analytics available.';
  return `Total: ${data.total_transactions} • Flagged: ${data.flagged_transactions}`;
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};