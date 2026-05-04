module.exports = {
  apps: [
    {
      name: 'uws-api-server',
      script: './lib/cli.js',
      args: ['--port', '3000', '--handlers-dir', './handlers'],
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_type: 'json',
    },
  ],
};
