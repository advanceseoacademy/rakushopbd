const { query } = require('../config/db');
const { getSiteSettings } = require('./siteSettings');
const { isConfigured } = require('./youcamApi');

/** Admin toggle: missing key = enabled */
function isAdminEnabled(settings) {
  return settings?.face_analyzer_enabled !== '0';
}

async function getFaceAnalyzerSettings() {
  const settings = await getSiteSettings(query);
  return {
    adminEnabled: isAdminEnabled(settings),
    apiConfigured: isConfigured(),
    enabled: isAdminEnabled(settings) && isConfigured(),
  };
}

module.exports = {
  isAdminEnabled,
  getFaceAnalyzerSettings,
};
