// api/check.js
import { promises as fs } from 'fs';
import { join } from 'path';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    const address = req.query.address;
    if (!address) {
      return res.status(400).send('❌ Falta parámetro address');
    }

    // 1) Geocoding
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const geoJson = await geoRes.json();
    if (!geoJson.length) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 2) Leer coords.json desde disco
    const jsonPath = join(process.cwd(), 'coords.json');
    const coordsText = await fs.readFile(jsonPath, 'utf-8');
    const coordsData = JSON.parse(coordsText);

    // 3) Construir polígono Turf
    const turfCoords = coordsData.map(c => [parseFloat(c.Longitud), parseFloat(c.Latitud)]);
    const turfPoly = polygon([turfCoords]);

    // 4) Punto y PIP
    const pt = point([parseFloat(lon), parseFloat(lat)]);
    const inside = booleanPointInPolygon(pt, turfPoly);

    // 5) Responder solo texto
    res.setHeader('Content-Type', 'text/plain');
    return res.send(inside ? '✅ Dentro del área' : '❌ Fuera del área');
  } catch (err) {
    console.error('ERROR en /api/check:', err);
    res.status(500).send('⚠️ Error interno en la función');
  }
}
