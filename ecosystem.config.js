module.exports = {
  apps: [
    {
      name:         "dirty-book-club",
      script:       "server.js",
      cwd:          "/home/ubuntu/dirty-book-club/backend",
      instances:    1,           // E2.1.Micro has 1 OCPU
      exec_mode:    "cluster",
      watch:        false,
      env: {
        NODE_ENV: "production",
        PORT:     3001,
      },
      error_file:   "/home/ubuntu/logs/dbc-error.log",
      out_file:     "/home/ubuntu/logs/dbc-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "512M",
      restart_delay: 3000,
    },
  ],
};
