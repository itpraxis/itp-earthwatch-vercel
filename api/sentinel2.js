// api/sentinel2.js
import dotenv from 'dotenv';
dotenv.config(); // Carga las variables de .env
import { JSDOM } from 'jsdom';
import { Buffer } from 'buffer';

// Polyfills
const { window } = new JSDOM();
global.document = window.document;
global.window = window;
global.self = window;
global.Buffer = Buffer;

// Importa node-fetch para ES Modules
import fetch from 'node-fetch';
global.fetch = fetch;

// Importa Earth Engine
import ee from '@google/earthengine';

// Configuración desde variables de entorno
const serviceAccount = {
  project_id: process.env.EE_PROJECT_ID,
  client_email: process.env.EE_CLIENT_EMAIL,
  private_key: process.env.EE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

let eeInitialized = false;

async function initEarthEngine() {
  if (eeInitialized) return;
  
  return new Promise((resolve, reject) => {
    ee.data.authenticate({
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
      project: serviceAccount.project_id
    }, () => {
      ee.initialize(null, () => {
        eeInitialized = true;
        resolve();
      }, reject);
    }, reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { coordinates } = req.body;

  if (!coordinates) {
    return res.status(400).json({ error: 'Faltan coordenadas' });
  }

  try {
    await initEarthEngine();

    const aoi = ee.Geometry.Polygon([coordinates]);

    const collection = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterBounds(aoi)
      .filterDate('2024-01-01', '2024-06-01')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .sort('CLOUDY_PIXEL_PERCENTAGE')
      .first();

    if (!collection) {
      return res.status(404).json({ error: 'No se encontraron imágenes' });
    }

    const thumbId = await new Promise((resolve, reject) => {
      collection.getThumbId({
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 3000,
        dimensions: '512x512',
        format: 'png'
      }, (err, thumbId) => {
        if (err) reject(err);
        else resolve(thumbId);
      });
    });

    const url = `https://earthengine.googleapis.com/api/thumb?thumbid=${thumbId.thumbid}`;

    res.status(200).json({ url });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};// Build trigger 09/03/2025 07:17:41
// Build trigger 09/03/2025 07:55:55 - Forzar detecci�n de funciones
// Build trigger 09/03/2025 08:24:34
// Build trigger 09/03/2025 08:35:54
