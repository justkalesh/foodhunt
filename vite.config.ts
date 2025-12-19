import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Ensure process.env is populated for the imported handler
  Object.assign(process.env, env);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Optional: keep proxy if needed, though we are doing manual middleware
      }
    },
    plugins: [
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req, res, next) => {
            try {
              // Lazy load the handler to ensure env is ready
              const handler = (await import('./api/chat.js')).default;

              // Simple body parser
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const data = Buffer.concat(buffers).toString();

              if (data) {
                try {
                  // @ts-ignore
                  req.body = JSON.parse(data);
                } catch (e) {
                  console.error('Failed to parse JSON body', e);
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                  return;
                }
              } else {
                // @ts-ignore
                req.body = {};
              }

              // Shim Vercel/Express methods
              // @ts-ignore
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              // @ts-ignore
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };

              // @ts-ignore
              await handler(req, res);
            } catch (error) {
              console.error('Middleware Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
          });

          // Middleware for /api/send-push
          server.middlewares.use('/api/send-push', async (req, res, next) => {
            try {
              // Lazy load the handler to ensure env is ready
              const handler = (await import('./api/send-push.js')).default;

              // Simple body parser
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const data = Buffer.concat(buffers).toString();

              if (data) {
                try {
                  // @ts-ignore
                  req.body = JSON.parse(data);
                } catch (e) {
                  console.error('Failed to parse JSON body', e);
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                  return;
                }
              } else {
                // @ts-ignore
                req.body = {};
              }

              // Shim Vercel/Express methods
              // @ts-ignore
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              // @ts-ignore
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };

              // @ts-ignore
              await handler(req, res);
            } catch (error) {
              console.error('Middleware Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error' + error.message }));
            }
          });

          // Middleware for /api/scan-menu
          server.middlewares.use('/api/scan-menu', async (req, res, next) => {
            try {
              // Lazy load the handler to ensure env is ready
              const handler = (await import('./api/scan-menu.js')).default;

              // Simple body parser
              const buffers = [];
              for await (const chunk of req) {
                buffers.push(chunk);
              }
              const data = Buffer.concat(buffers).toString();

              if (data) {
                try {
                  // @ts-ignore
                  req.body = JSON.parse(data);
                } catch (e) {
                  console.error('Failed to parse JSON body', e);
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid JSON' }));
                  return;
                }
              } else {
                // @ts-ignore
                req.body = {};
              }

              // Shim Vercel/Express methods
              // @ts-ignore
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              // @ts-ignore
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };

              // @ts-ignore
              await handler(req, res);
            } catch (error) {
              console.error('Middleware Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Internal Server Error: ' + error.message }));
            }
          });
        }
      }
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
