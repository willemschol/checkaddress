// api/check.js
import coordsData from './coords.json';
import { polygon, point, booleanPointInPolygon } from '@turf/turf';

export default async function handler(req, res) {
  try {
    // 1) Parámetro address
    const address = req.query.address;
    if (!address) {
      res.status(400).setHeader('Content-Type','text/plain');
      return res.send('❌ Falta parámetro address');
    }

    // 2) Geocoding con User-Agent (requerido por Nominatim)
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
      res.status(200).setHeader('Content-Type','text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 3) Verificar en cada área
    const insideAreas = [];
    for (const area of coordsData) {
      // Construir el anillo [lng, lat]
      const ring = area.coordinates.map(c => [
        parseFloat(c.Longitud),
        parseFloat(c.Latitud)
      ]);
      if (ring.length < 3) continue; // ignorar áreas inválidas

      // Cerrar el anillo si hace falta
      const [x0,y0] = ring[0];
      const [xn,yn] = ring[ring.length-1];
      if (x0 !== xn || y0 !== yn) ring.push([x0,y0]);

      // Crear polígono y comprobar punto
      const turfPoly = polygon([ring]);
      const pt       = point([parseFloat(lon), parseFloat(lat)]);
      if (booleanPointInPolygon(pt, turfPoly)) {
        insideAreas.push(area.id);
      }
    }

    // 4) Preparar respuesta
    const result = insideAreas.length
      ? `✅ Dentro de: ${insideAreas.join(', ')}`
      : '❌ Fuera de todas las áreas';

    res.status(200).setHeader('Content-Type','text/plain');
    return res.send(result);

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    res.status(500).setHeader('Content-Type','text/plain');
    return res.send(`⚠️ Error interno en la función:\n${err.message}`);
  }
}
