// server.js
const express = require('express');
const axios = require('axios');
const scrapeMilanuncios = require('./scrap');
const { checkSystemStatus } = require('./health-check');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware para parsear JSON
app.use(express.json());

// Endpoint para scraping con método GET
app.get('/scrape', async (req, res) => {
  try {
    // Extrae los parámetros de búsqueda desde la query string
    const searchParams = req.query;
    console.log('Parámetros recibidos:', searchParams);

    let intentos = 0;
    let data = [];

    // Intentar hasta 3 veces o hasta obtener resultados
    const maxIntentos = 3;
    while (intentos < maxIntentos) {
      console.log('Realizando scraping...');
      console.log('Intento nro:', intentos + 1);
      intentos++;

      data = await scrapeMilanuncios(searchParams);

      if (data.length > 0) {
        console.log(`Obtenidos ${data.length} resultados en el intento ${intentos}`);
        break;
      }

      // Si llegamos al último intento sin resultados, devolver array vacío
      if (intentos >= maxIntentos) {
        console.log(`No se encontraron resultados después de ${maxIntentos} intentos`);
      }
    }

    // Enviar la data al flujo de n8n si está configurado
    if (data.length > 0 && process.env.N8N_WEBHOOK_URL) {
      try {
        await axios.post(process.env.N8N_WEBHOOK_URL, data, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Datos enviados exitosamente al flujo de n8n');
      } catch (error) {
        console.error('Error al enviar datos a n8n:', error.message);
      }
    }

    // Responder al cliente
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en scraping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para scraping con método POST
app.post('/scrape', async (req, res) => {
  try {
    // Extrae los parámetros de búsqueda desde el body
    const searchParams = req.body;
    console.log('Parámetros recibidos (POST):', searchParams);

    let intentos = 0;
    let data = [];

    // Intentar hasta 3 veces o hasta obtener resultados
    const maxIntentos = 3;
    while (intentos < maxIntentos) {
      console.log('Realizando scraping...');
      console.log('Intento nro:', intentos + 1);
      intentos++;

      data = await scrapeMilanuncios(searchParams);

      if (data.length > 0) {
        console.log(`Obtenidos ${data.length} resultados en el intento ${intentos}`);
        break;
      }

      // Si llegamos al último intento sin resultados, devolver array vacío
      if (intentos >= maxIntentos) {
        console.log(`No se encontraron resultados después de ${maxIntentos} intentos`);
      }
    }

    // Enviar la data al flujo de n8n si está configurado
    if (data.length > 0 && process.env.N8N_WEBHOOK_URL) {
      try {
        await axios.post(process.env.N8N_WEBHOOK_URL, data, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Datos enviados exitosamente al flujo de n8n');
      } catch (error) {
        console.error('Error al enviar datos a n8n:', error.message);
      }
    }

    // Responder al cliente
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en scraping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de diagnóstico completo
app.get('/status', async (req, res) => {
  try {
    console.log('Ejecutando diagnóstico completo del sistema...');
    const statusReport = await checkSystemStatus();

    // Si el estado general es error, devolver código 500
    if (statusReport.overallStatus === 'error') {
      return res.status(500).json(statusReport);
    }

    // Si el estado general es warning, devolver código 200 pero con los datos de warning
    res.json(statusReport);
  } catch (error) {
    console.error('Error al generar informe de estado:', error);
    res.status(500).json({
      success: false,
      overallStatus: 'error',
      error: error.message
    });
  }
});

// Endpoint de health check simple (para Kubernetes o balanceadores)
app.get('/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Servicio de Scraping</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .endpoint { background: #f4f4f4; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
          code { background: #eee; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Servicio de Scraping</h1>
        <p>Servidor funcionando correctamente.</p>
        
        <div class="endpoint">
          <h3>Endpoints disponibles:</h3>
          <ul>
            <li><code>GET /scrape?categoria=motor&busqueda=fiat</code> - Realizar scraping con los parámetros indicados</li>
            <li><code>POST /scrape</code> - Realizar scraping con parámetros en formato JSON</li>
            <li><code>GET /status</code> - Informe completo del estado del sistema</li>
            <li><code>GET /health</code> - Health check simple</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});