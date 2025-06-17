import { promises as fs } from 'fs';
import { join } from 'path';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    const address = req.query.address;
    if (!address) return res.status(400).send('❌ Falta parámetro address');

    // 1) Geocoding
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const geoJson = await geoRes.json();
    if (!Array.isArray(geoJson) || !geoJson.length) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 2) Leer coords.json desde public/
    const jsonPath   = join(process.cwd(), 'public', 'coords.json');
    const coordsText = await fs.readFile(jsonPath, 'utf-8');
    const coordsData = JSON.parse(coordsText);

    // 3) Construir y cerrar el ring
    let ring = coordsData.map(c => [parseFloat(c.Longitud), parseFloat(c.Latitud)]);
    if (ring.length < 3) throw new Error('coords.json debe tener mínimo 3 puntos');
    const [x0,y0] = ring[0], [x1,y1] = ring[ring.length-1];
    if (x0 !== x1 || y0 !== y1) ring.push([x0, y0]);

    // 4) PIP con Turf
    const turfPoly = polygon([ring]);
    const pt       = point([parseFloat(lon), parseFloat(lat)]);
    const inside   = booleanPointInPolygon(pt, turfPoly);

    // 5) Devolver solo texto
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
