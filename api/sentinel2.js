// api/sentinel2.js
import dotenv from 'dotenv';
dotenv.config();

import { JSDOM } from 'jsdom';
import { Buffer } from 'buffer';

// Polyfills
const { window } = new JSDOM();
global.document = window.document;
global.window = window;
global.self = window;
global.Buffer = Buffer;

// Importa node-fetch
import fetch from 'node-fetch';
global.fetch = fetch;

// Importa Earth Engine
import ee from '@google/earthengine';

// Verifica variables de entorno
console.log('🔍 Verificando variables de entorno...');
console.log('EE_PROJECT_ID:', process.env.EE_PROJECT_ID);
console.log('EE_CLIENT_EMAIL:', process.env.EE_CLIENT_EMAIL);
console.log('EE_PRIVATE_KEY:', process.env.EE_PRIVATE_KEY ? '✅ Definida' : '❌ No definida');

// Configuración desde variables de entorno
const serviceAccount = {
  project_id: process.env.EE_PROJECT_ID,
  client_email: process.env.EE_CLIENT_EMAIL,
  private_key: process.env.EE_PRIVATE_KEY?.replace(/\\n/g, '\n') || ''
};

let eeInitialized = false;

async function initEarthEngine() {
  if (eeInitialized) return;
  
  console.log('🔄 Iniciando autenticación con Earth Engine...');
  
  return new Promise((resolve, reject) => {
    ee.data.authenticate({
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
      project: serviceAccount.project_id
    }, () => {
      console.log('✅ Autenticación exitosa');
      ee.initialize(null, () => {
        console.log('✅ Earth Engine inicializado');
        eeInitialized = true;
        resolve();
      }, reject);
    }, (error) => {
      console.error('❌ Error en autenticación:', error);
      reject(error);
    });
  });
}

export default async function handler(req, res) {
  try {
    console.log('📥 Solicitud recibida:', req.method, req.url);
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { coordinates } = req.body;

    if (!coordinates) {
      return res.status(400).json({ error: 'Faltan coordenadas' });
    }

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
        if (err) {
          console.error('❌ Error al obtener thumbId:', err);
          reject(err);
        } else {
          resolve(thumbId);
        }
      });
    });

    const url = `https://earthengine.googleapis.com/api/thumb?thumbid=${thumbId.thumbid}`;

    console.log('🌐 URL generada:', url);
    res.status(200).json({ url });

  } catch (error) {
    console.error('❌ Error crítico:', error);
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
};