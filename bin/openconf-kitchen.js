#!/usr/bin/env node
import { createKitchenServer } from '../server.js';

const port = Number(process.env.PORT ?? process.argv[2] ?? 4100);

createKitchenServer()
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is taken. Try: PORT=4101 npx --allow-git=all github:filkaris/openconf-kitchen`);
      console.error('Then start the app with KITCHEN_API_URL=http://localhost:4101 npm start');
      process.exit(1);
    }
    throw err;
  })
  .listen(port, () => {
    console.log(`OpenConf Burgers kitchen API running on http://localhost:${port}`);
    console.log('Leave this terminal open.');
  });
