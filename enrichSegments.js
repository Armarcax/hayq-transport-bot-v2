// enrichSegments.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const routesPath = path.join(__dirname, 'backend', 'data', 'routes_small_full.json');
const outputPath = path.join(__dirname, 'backend', 'data', 'routes_with_segments.json');

const apiKey = process.env.YANDEX_API_KEY;
if (!apiKey) {
  console.error("❌ YANDEX_API_KEY not found in .env file!");
  process.exit(1);
}

async function getDistanceAndDuration(coordsA, coordsB) {
  const url = `https://api.routing.yandex.net/v2/route?apikey=${apiKey}&waypoints=${coordsA.lng},${coordsA.lat}|${coordsB.lng},${coordsB.lat}&lang=ru_RU`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`⚠️ HTTP ${res.status} for segment ${coordsA.lat},${coordsA.lng} → ${coordsB.lat},${coordsB.lng}`);
      return null;
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    return {
      distance: route.legs[0].distance.value, // մետրեր
      duration: route.legs[0].duration.value, // վայրկյաններ
      polyline: route.geometry.coordinates // polyline (կետերի հաջորդականություն)
    };
  } catch (err) {
    console.error(`❌ Failed segment request: ${err.message}`);
    return null;
  }
}

async function enrichOneRoute(routeId) {
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  const route = routes.find(r => r.id === routeId);
  if (!route) {
    console.error(`❌ Route with id ${routeId} not found!`);
    return;
  }

  console.log(`🚌 Processing route: ${routeId} | ${route.start} → ${route.end}`);
  const segments = [];

  for (let i = 0; i < route.stops.length - 1; i++) {
    const current = route.stops[i];
    const next = route.stops[i + 1];

    if (!current.coords || !next.coords) {
      console.warn(`⚠️ Skipping segment ${i} – missing coords`);
      continue;
    }

    console.log(`   🔄 Segment ${i + 1}: ${current.name.hy || current.name} → ${next.name.hy || next.name}`);
    const result = await getDistanceAndDuration(current.coords, next.coords);

    if (result) {
      console.log(`      ✅ ${result.distance} m | ${Math.round(result.duration / 60)} min`);
      segments.push({
        from: current.name,
        to: next.name,
        distance: result.distance,
        duration: result.duration,
        polyline: result.polyline
      });
    } else {
      console.log(`      ❌ Failed to get segment data`);
    }

    await new Promise(r => setTimeout(r, 1000)); // 1 վրկ sleep Yandex API լիմիտի համար
  }

  fs.writeFileSync(outputPath, JSON.stringify({ routeId, segments }, null, 2), 'utf8');
  console.log(`\n💾 Saved route ${routeId} with ${segments.length} segments to ${outputPath}`);
}

enrichOneRoute(42); // 👈 փոխիր այս ID-ն որը ուզում ես փորձարկես
