// api/check.js
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  try {
    // 1) Validar parámetro `address`
    const address = req.query.address;
    if (!address) {
      // No existe `res.type()` en Vercel; usar setHeader + send
      res.setHeader('Content-Type', 'text/plain');
      res.status(400).send('❌ Falta parámetro address');
      return;
    }

    // 2) Geocoding (Nominatim requiere User-Agent)
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      {
        headers: {
          'User-Agent': 'CheckAddressApp/1.0 (contacto@tudominio.com)',
          'Accept': 'application/json'
        }
      }
    );
    if (!geoRes.ok) {
      throw new Error(`Geocoding failed: ${geoRes.status} ${geoRes.statusText}`);
    }
    const geoJson = await geoRes.json();
    if (!Array.isArray(geoJson) || geoJson.length === 0) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send('❌ Dirección no encontrada');
      return;
    }
    const { lat, lon } = geoJson[0];

    // 3) Leer el JSON de áreas desde disco (dentro de api/)
    const jsonPath   = join(__dirname, 'coords.json');
    const coordsText = await fs.readFile(jsonPath, 'utf-8');
    const areas      = JSON.parse(coordsText);

    // 4) Para cada área, construir el anillo y comprobar Point-In-Polygon
    const insideAreas = [];
    for (const area of areas) {
      const ring = area.coordinates.map(c => [
        parseFloat(c.Longitud),
        parseFloat(c.Latitud)
      ]);
      if (ring.length < 3) continue;  // sin suficientes puntos

      // auto-cerrar el anillo
      const [x0, y0] = ring[0];
      const [xn, yn] = ring[ring.length - 1];
      if (x0 !== xn || y0 !== yn) ring.push([x0, y0]);

      const turfPoly = polygon([ring]);
      const pt       = point([parseFloat(lon), parseFloat(lat)]);
      if (booleanPointInPolygon(pt, turfPoly)) {
        insideAreas.push(area.id);
      }
    }

    // 5) Responder solo texto plano
    const result = insideAreas.length
      ? `✅ Dentro de: ${insideAreas.join(', ')}`
      : '❌ Fuera de todas las áreas';

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(result);

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    res.setHeader('Content-Type', 'text/plain');
    res.status(500).send(`⚠️ Error interno en la función:\n${err.message}`);
  }
}
