// Servidor mínimo para testar Railway
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

console.log('🚀 Iniciando servidor de teste...');
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);

app.get('/', (req, res) => {
  res.json({
    message: 'Servidor funcionando!',
    port: PORT,
    host: HOST,
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL
    }
  });
});

app.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor rodando em ${HOST}:${PORT}`);
  console.log(`🔗 URL: http://${HOST}:${PORT}`);
});

// Logs de debug
setInterval(() => {
  console.log('🔄 Keep alive:', new Date().toISOString());
}, 30000);