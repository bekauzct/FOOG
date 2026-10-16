// PM2: pm2 start deploy/ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    { name: 'foog-api', cwd: './api', script: 'dist/index.js', env: { NODE_ENV: 'production' }, max_memory_restart: '600M' },
    { name: 'foog-web', cwd: './web', script: 'node_modules/next/dist/bin/next', args: 'start -p 3000', env: { NODE_ENV: 'production' } },
  ],
};
