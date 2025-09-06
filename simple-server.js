// Servidor super simples para Railway
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
console.log('🚀 Iniciando servidor simples...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

app.get('/ping', (req, res) => {
  console.log('📱 Ping recebido');
  res.json({ 
    message: 'pong',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'FECITAC Bot - Servidor funcionando!',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: ['/ping', '/health'],
    port: PORT
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔗 URL: http://0.0.0.0:${PORT}`);
  setInterval(() => {
    console.log('🔄 Keep alive:', new Date().toISOString());
  }, 30000);
});