// api/check.js
import { promises as fs } from 'fs';
import { join } from 'path';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    // 1) Parámetro address
    const address = req.query.address;
    if (!address) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(400).send('❌ Falta parámetro address');
    }

    // 2) Geocoding con Nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const geoJson = await geoRes.json();
    if (!Array.isArray(geoJson) || geoJson.length === 0) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 3) Leer coords.json
    const jsonPath  = join(process.cwd(), 'coords.json');
    const coordsTxt = await fs.readFile(jsonPath, 'utf-8');
    const raw       = JSON.parse(coordsTxt);

    // 4) Crear punto Turf
    const pt = point([parseFloat(lon), parseFloat(lat)]);

    // 5) Para cada área, construir su polígono y comprobar si el punto está dentro
    const insideAreas = raw
      .filter(area => Array.isArray(area.coordinates) && area.coordinates.length >= 3)
      .map(area => {
        // Construye el anillo de [lng, lat]
        const ring = area.coordinates.map(c => [
          parseFloat(c.Longitud),
          parseFloat(c.Latitud)
        ]);
        // Cierra el anillo si hace falta
        const first = ring[0];
        const last  = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push(first);
        }
        return {
          id: area.id,
          poly: polygon([ring])
        };
      })
      .filter(a => booleanPointInPolygon(pt, a.poly))
      .map(a => a.id);

    // 6) Devolver resultado
    res.setHeader('Content-Type', 'text/plain');
    if (insideAreas.length > 0) {
      return res.send(`✅ Dentro de: ${insideAreas.join(', ')}`);
    } else {
      return res.send('❌ Fuera de todas las áreas');
    }

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    // ¡Aquí devolvemos el mensaje del error para depurar!
    res
      .status(500)
      .setHeader('Content-Type', 'text/plain')
      .send(`⚠️ Error interno en la función:\n${err.message}`);
  }
}
