// api/check.js
import { promises as fs } from 'fs';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  try {
    // 1) Parámetro
    const address = req.query.address;
    if (!address) return res.status(400).send('❌ Falta parámetro address');

    // 2) Geocoding
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const geoJson = await geoRes.json();
    if (!Array.isArray(geoJson) || !geoJson.length) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 3) Leer coords.json **desde disco** (ruta relativa al módulo)
    const jsonPath = join(__dirname, '..', 'coords.json');
    const coordsText = await fs.readFile(jsonPath, 'utf-8');
    const coordsData = JSON.parse(coordsText);

    // 4) Construir el LinearRing y cerrar el polígono
    let ring = coordsData.map(c => [parseFloat(c.Longitud), parseFloat(c.Latitud)]);
    if (ring.length < 3) throw new Error('coords.json debe tener mínimo 3 puntos');
    const [fLng,fLat] = ring[0], [lLng,lLat] = ring[ring.length-1];
    if (fLng !== lLng || fLat !== lLat) ring.push([fLng, fLat]);

    // 5) Turf & PIP
    const turfPoly = polygon([ring]);
    const pt = point([parseFloat(lon), parseFloat(lat)]);
    const inside = booleanPointInPolygon(pt, turfPoly);

    // 6) Responder solo texto
    res.setHeader('Content-Type', 'text/plain');
    return res.send(inside ? '✅ Dentro del área' : '❌ Fuera del área');

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    res
      .status(500)
      .setHeader('Content-Type', 'text/plain')
      .send(`⚠️ Error interno en la función:\n${err.message}`);
  }
}
