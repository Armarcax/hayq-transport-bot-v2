// fixDuplicates.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const routesPath = path.join(__dirname, 'backend', 'data', 'routes_small_full.json');
const backupPath = path.join(__dirname, 'backend', 'data', 'routes_small_full.backup.json');
const duplicatePath = path.join(__dirname, 'backend', 'data', 'duplicate_stops.json');

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
if (!YANDEX_API_KEY) {
  console.error("❌ YANDEX_API_KEY not found in .env file!");
  process.exit(1);
}

// Load routes
let routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

// Map coordinates to stops
const coordMap = {};
for (const route of routes) {
  if (!Array.isArray(route.stops)) continue;
  for (const stop of route.stops) {
    if (!stop.coords) continue;
    const key = `${stop.coords.lat},${stop.coords.lng}`;
    coordMap[key] = coordMap[key] || [];
    coordMap[key].push({ route: route.number, stopId: stop.id, stop });
  }
}

// Find duplicates
const duplicates = Object.values(coordMap).filter(arr => arr.length > 1).flat();
console.log(`⚠️ Found ${duplicates.length} duplicate stops.`);

// Yandex geocode
async function geocodeStop(stop) {
  const names = [stop.name?.hy, stop.name?.ru, stop.name?.en].filter(Boolean);
  for (const name of names) {
    const query = encodeURIComponent(name + ', Yerevan, Armenia');
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&geocode=${query}&format=json&results=5`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const members = data?.response?.GeoObjectCollection?.featureMember || [];
      if (!members.length) continue;
      const pos = members[0].GeoObject.Point.pos.split(' ');
      return { lat: parseFloat(pos[1]), lng: parseFloat(pos[0]) };
    } catch (err) {
      console.warn(`⚠️ Error geocoding "${name}": ${err.message}`);
    }
  }
  return null;
}

// Process duplicates sequentially
(async () => {
  for (const entry of duplicates) {
    const { stop, route, stopId } = entry;
    console.log(`🔄 Geocoding duplicate stop [Route ${route} | ID ${stopId}]`);

    const coords = await geocodeStop(stop);
    if (coords) {
      stop.coords = coords;
      console.log(`   ✅ Updated: ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`   ❌ Failed to geocode`);
    }

    await new Promise(r => setTimeout(r, 3000)); // 3 sec delay
  }

  // Save files
  fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2), 'utf8');
  fs.writeFileSync(backupPath, JSON.stringify(routes, null, 2), 'utf8');
  fs.writeFileSync(duplicatePath, JSON.stringify(duplicates, null, 2), 'utf8');
  console.log("✅ Duplicates processed and saved.");
})();
