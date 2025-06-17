// api/check.js
import coordsData from './coords.js';              // <-- IMPORTAMOS tu JSON
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    const address = req.query.address;
    if (!address) return res.status(400).send('❌ Falta parámetro address');

    // 1) Geocoding
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    const results = await geo.json();
    if (!Array.isArray(results) || !results.length) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = results[0];

    // 2) Construir anillo de coordenadas [lng,lat]
    let ring = coordsData.map(c => [
      parseFloat(c.Longitud),
      parseFloat(c.Latitud)
    ]);

    // Validación mínima y cierre automático
    if (ring.length < 3) throw new Error('Necesito al menos 3 puntos en coordsData');
    const [x0,y0] = ring[0], [x1,y1] = ring[ring.length-1];
    if (x0 !== x1 || y0 !== y1) ring.push([x0, y0]);

    // 3) Turf: polígono y PIP
    const turfPoly = polygon([ring]);
    const pt       = point([parseFloat(lon), parseFloat(lat)]);
    const inside   = booleanPointInPolygon(pt, turfPoly);

    // 4) Responder solo texto
    res.setHeader('Content-Type', 'text/plain');
    return res.send(inside ? '✅ Dentro del área' : '❌ Fuera del área');

  } catch (err) {
    console.error('ERROR in /api/check:', err);
    res
      .status(500)
      .setHeader('Content-Type', 'text/plain')
      .send(`⚠️ Function crashed:\n${err.stack}`);
  }
}
