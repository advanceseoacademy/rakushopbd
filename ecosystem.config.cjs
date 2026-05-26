/** PM2 — CyberPanel VPS: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'rakushopbd',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
