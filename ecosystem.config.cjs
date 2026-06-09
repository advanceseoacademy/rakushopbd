/** PM2 — CyberPanel VPS: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'rakushopbd',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      kill_timeout: 5000,
      min_uptime: '10s',
      max_restarts: 15,
      exp_backoff_restart_delay: 200,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
