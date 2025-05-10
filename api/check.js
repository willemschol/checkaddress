import { polygon, point, booleanPointInPolygon } from '@turf/turf';
import coordsData from '../coords.json' assert { type: 'json' };

export default async function handler(req, res) {
  // 1. Parámetro address
  const address = req.query.address;
  if (!address) {
    res.status(400).send('❌ Falta parámetro address');
    return;
  }

  // 2. Geocoding con Nominatim
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
  );
  const results = await geoRes.json();
  if (!results.length) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('❌ Dirección no encontrada');
    return;
  }
  const { lat, lon } = results[0];

  // 3. Construir polígono con Turf
  const turfCoords = coordsData.map(c => [parseFloat(c.Longitud), parseFloat(c.Latitud)]);
  const turfPoly = polygon([turfCoords]);

  // 4. Verificar si el punto está dentro
  const pt = point([parseFloat(lon), parseFloat(lat)]);
  const inside = booleanPointInPolygon(pt, turfPoly);

  // 5. Responder solo texto
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(inside ? '✅ Dentro del área' : '❌ Fuera del área');
}
