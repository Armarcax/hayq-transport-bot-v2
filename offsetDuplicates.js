// offsetDuplicatesWithETA.js
const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'backend', 'data', 'routes_small_full_with_eta.json');
const backupPath = path.join(__dirname, 'backend', 'data', 'routes_small_full_with_eta.offset.backup.json');

// Load routes
let routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
fs.writeFileSync(backupPath, JSON.stringify(routes, null, 2), 'utf8');
console.log(`📦 Backup saved at ${backupPath}`);

// Small random offset function (~2 meters)
function getOffset() {
  const factor = 0.00002;
  return (Math.random() - 0.5) * factor;
}

// Use toFixed(5) for slightly wider duplicate detection
const coordMap = {};
for (const route of routes) {
  if (!Array.isArray(route.stops)) continue;
  for (const stop of route.stops) {
    if (!stop.coords) continue;
    const key = `${stop.coords.lat.toFixed(5)},${stop.coords.lng.toFixed(5)}`;
    coordMap[key] = coordMap[key] || [];
    coordMap[key].push(stop);
  }
}

// Apply offset to duplicates
let totalOffset = 0;
for (const stops of Object.values(coordMap)) {
  if (stops.length > 1) {
    stops.forEach((stop, idx) => {
      if (idx === 0) return; // leave first one as is
      stop.coords.lat += getOffset();
      stop.coords.lng += getOffset();
      totalOffset++;
    });
  }
}

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2), 'utf8');
console.log(`✅ Applied offset to ${totalOffset} duplicate stops. ${routesPath} updated.`);
