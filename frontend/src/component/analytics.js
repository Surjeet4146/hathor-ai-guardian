* @param {Object} data - Analytics data from WebSocket
 * @returns {Array} formatted chart data
 */
export const formatRiskDistribution = (data) => {
  if (!data) return [];

  return [
    { label: 'High Risk', value: data.high_risk || 0, color: '#FF4C4C' },
    { label: 'Medium Risk', value: data.medium_risk || 0, color: '#FFA500' },
    { label: 'Low Risk', value: data.low_risk || 0, color: '#4CAF50' },
  ];
};

/**
 * Returns a human-readable summary from analytics data
 * @param {Object} data
 * @returns {String} summary text
 */
export const getAnalyticsSummaryText = (data) => {
  if (!data) return 'No analytics available.';
  return `Total: ${data.total_transactions} • Flagged: ${data.flagged_transactions}`;
};

/**
 * Formats a Unix timestamp into a human-readable string
 * @param {Number} timestamp
 * @returns {String}
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};
