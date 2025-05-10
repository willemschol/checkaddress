// api/check.js
import { promises as fs } from 'fs';
import { join } from 'path';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    // 1) Parámetro address
    const address = req.query.address;
    if (!address) {
      res.status(400).send('❌ Falta parámetro address');
      return;
    }

    // 2) Geocoding con Nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const geoJson = await geoRes.json();
    if (!Array.isArray(geoJson) || geoJson.length === 0) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send('❌ Dirección no encontrada');
      return;
    }
    const { lat, lon } = geoJson[0];

    // 3) Leer coords.json desde disco
    const jsonPath = join(process.cwd(), 'coords.json');
    const coordsText = await fs.readFile(jsonPath, 'utf-8');
    const coordsData = JSON.parse(coordsText);

    // 4) Preparar array de posiciones [lng, lat]
    let turfCoords = coordsData.map(c => [
      parseFloat(c.Longitud),
      parseFloat(c.Latitud)
    ]);

    // 4.a) Validar que hay al menos 3 vértices
    if (turfCoords.length < 3) {
      throw new Error('coords.json debe tener al menos 3 puntos para construir un polígono');
    }

    // 4.b) Cerrar el LinearRing (repetir primer punto al final)
    const first = turfCoords[0];
    const last = turfCoords[turfCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      turfCoords.push(first);
    }

    // 5) Construir el polígono con Turf
    const turfPoly = polygon([turfCoords]);

    // 6) Punto a verificar
    const pt = point([parseFloat(lon), parseFloat(lat)]);
    const inside = booleanPointInPolygon(pt, turfPoly);

    // 7) Responder solo texto
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(inside ? '✅ Dentro del área' : '❌ Fuera del área');

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    res.status(500).send('⚠️ Error interno en la función');
  }
}
