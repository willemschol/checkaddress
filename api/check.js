// api/check.js
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
    if (!Array.isArray(geoJson) || geoJson.length === 0) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('❌ Dirección no encontrada');
    }
    const { lat, lon } = geoJson[0];

    // 2) Leer coords.json
    const jsonPath  = join(process.cwd(), 'coords.json');
    const coordsTxt = await fs.readFile(jsonPath, 'utf-8');
    const raw       = JSON.parse(coordsTxt);

    // 3) Normalizar a array de puntos {Latitud, Longitud}
    let allPoints;
    if (raw.length && raw[0].Latitud !== undefined) {
      // formato plano
      allPoints = raw;
    } else if (raw.length && raw[0].coordinates) {
      // formato multi-área
      allPoints = raw.flatMap(a => a.coordinates);
    } else {
      throw new Error('coords.json no tiene el formato esperado');
    }

    if (allPoints.length < 3) {
      throw new Error('coords.json debe tener al menos 3 puntos para construir un polígono');
    }

    // 4) Construir LinearRing [ [lng,lat], … ]
    const ring = allPoints.map(c => [
      parseFloat(c.Longitud),
      parseFloat(c.Latitud)
    ]);
    // cerrar el ring si hace falta
    const [fLng,fLat] = ring[0];
    const [lLng,lLat] = ring[ring.length-1];
    if (fLng !== lLng || fLat !== lLat) ring.push([fLng,fLat]);

    // 5) Turf Polygon & PIP
    const turfPoly = polygon([ring]);
    const pt       = point([parseFloat(lon), parseFloat(lat)]);
    const inside   = booleanPointInPolygon(pt, turfPoly);

    // 6) Respuesta
    res.setHeader('Content-Type', 'text/plain');
    return res.send(inside ? '✅ Dentro del área' : '❌ Fuera del área');

  } catch (err) {
    console.error('ERROR en /api/check:', err);
    return res.status(500).send('⚠️ Error interno en la función');
  }
}
