// health-check.js
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');
const puppeteer = require('puppeteer');
const util = require('util');
const execAsync = util.promisify(exec);
const axios = require('axios');

// Comprueba el estado del sistema y de la conexión con Chromium
async function checkSystemStatus() {
  const status = {
    timestamp: new Date().toISOString(),
    system: {
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
      freeMemory: `${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
      cpus: os.cpus().length,
      loadAverage: os.loadavg()
    },
    nodeInfo: {
      version: process.version,
      env: process.env.NODE_ENV || 'development',
      pid: process.pid
    },
    puppeteer: {
      status: 'pending',
      version: require('puppeteer/package.json').version
    },
    chromiumService: {
      status: 'pending',
      connectionStatus: null,
      debuggingUrl: 'ws://chromium:9222/devtools/browser',
      versionInfo: null
    },
    dependencies: {
      status: 'pending',
      details: {}
    },
    diskSpace: {
      status: 'pending',
      details: null
    },
    networkConnectivity: {
      status: 'pending',
      details: null
    },
    overallStatus: 'pending'
  };

  try {
    // Comprobar conectividad con el servicio de Chromium
    try {
      // Primero intentamos conectarnos al endpoint HTTP de Chromium para obtener info
      const response = await axios.get('http://chromium:9222/json/version', {
        timeout: 5000
      });

      status.chromiumService.versionInfo = response.data;
      status.chromiumService.connectionStatus = 'connected';

      // Probar que Puppeteer puede conectarse correctamente
      const browser = await puppeteer.connect({
        browserWSEndpoint: status.chromiumService.debuggingUrl,
        timeout: 10000 // 10 segundos de timeout
      });

      // Obtener la versión del navegador
      const version = await browser.version();
      status.puppeteer.browserVersion = version;
      status.puppeteer.status = 'ok';

      // Crear una página para una prueba más completa
      const page = await browser.newPage();
      await page.goto('about:blank');
      await page.close();

      // No cerrar el navegador remoto, solo desconectar
      await browser.disconnect();

      status.chromiumService.status = 'ok';
    } catch (error) {
      status.chromiumService.status = 'error';
      status.chromiumService.error = error.message;
      status.puppeteer.status = 'error';
      status.puppeteer.error = 'No se pudo conectar al servicio de Chromium';
    }

    // Comprobar dependencias de Node.js
    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      status.dependencies.details = Object.keys(dependencies).reduce((acc, dep) => {
        acc[dep] = dependencies[dep];
        return acc;
      }, {});

      status.dependencies.status = 'ok';
    } catch (error) {
      status.dependencies.status = 'warning';
      status.dependencies.error = error.message;
    }

    // Comprobar espacio en disco
    try {
      const { stdout } = await execAsync('df -h .');
      const lines = stdout.split('\n');
      if (lines.length >= 2) {
        const diskInfo = lines[1].split(/\s+/);
        status.diskSpace.details = {
          filesystem: diskInfo[0],
          size: diskInfo[1],
          used: diskInfo[2],
          available: diskInfo[3],
          usedPercentage: diskInfo[4]
        };
        // Advertir si queda menos del 10% de espacio disponible
        const usedPercentage = parseInt(diskInfo[4].replace('%', ''));
        status.diskSpace.status = usedPercentage > 90 ? 'warning' : 'ok';
      }
    } catch (error) {
      status.diskSpace.status = 'error';
      status.diskSpace.error = error.message;
    }

    // Comprobar conectividad de red externa
    try {
      await execAsync('ping -c 1 8.8.8.8');
      status.networkConnectivity.status = 'ok';
      status.networkConnectivity.details = 'Internet connectivity confirmed';
    } catch (error) {
      status.networkConnectivity.status = 'warning';
      status.networkConnectivity.details = 'Internet connectivity issue detected';
    }

    // Determinar el estado general basado en todos los componentes
    const hasErrors = [
      status.chromiumService.status,
      status.puppeteer.status,
      status.dependencies.status,
      status.diskSpace.status,
      status.networkConnectivity.status
    ].some(s => s === 'error');

    const hasWarnings = [
      status.chromiumService.status,
      status.puppeteer.status,
      status.dependencies.status,
      status.diskSpace.status,
      status.networkConnectivity.status
    ].some(s => s === 'warning');

    if (hasErrors) {
      status.overallStatus = 'error';
    } else if (hasWarnings) {
      status.overallStatus = 'warning';
    } else {
      status.overallStatus = 'ok';
    }

  } catch (error) {
    status.overallStatus = 'error';
    status.error = error.message;
  }

  return status;
}

module.exports = { checkSystemStatus };