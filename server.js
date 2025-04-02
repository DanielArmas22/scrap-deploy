// server.js
const express = require('express');
const axios = require('axios');
const scrapeMilanuncios = require('./scrap');

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Ruta para verificar estado del servidor
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servicio de scraping funcionando correctamente' });
});

// Ruta principal de scraping
app.get('/scrape', async (req, res) => {
  try {
    // Extrae los parámetros de búsqueda desde la query string
    const searchParams = req.query;
    console.log('Parámetros recibidos:', searchParams);

    // Llama a la función de scraping con los parámetros recibidos
    const data = await scrapeMilanuncios(searchParams);

    // Enviar la data al flujo de n8n
    const n8nWebhookUrl = 'https://n8n.sitemaster.lat/webhook-test/leotest'; // Reemplaza con tu URL real
    await axios.post(n8nWebhookUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Datos enviados exitosamente al flujo de n8n');

    // Responder al cliente
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en scraping o envío a n8n:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para ejecutar scraping con parámetros en JSON (útil para peticiones POST)
app.post('/scrape', async (req, res) => {
  try {
    // Extrae los parámetros de búsqueda desde el body
    const searchParams = req.body;
    console.log('Parámetros recibidos (POST):', searchParams);

    // Llama a la función de scraping con los parámetros recibidos
    const data = await scrapeMilanuncios(searchParams);

    // Enviar la data al flujo de n8n
    const n8nWebhookUrl = 'https://n8n.sitemaster.lat/webhook-test/leotest'; // Reemplaza con tu URL real
    await axios.post(n8nWebhookUrl, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Datos enviados exitosamente al flujo de n8n');

    // Responder al cliente
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error en scraping o envío a n8n:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});