import json
import os
import math

# --- Haversine formula ---
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

# --- Paths ---
data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
input_file = os.path.join(data_dir, 'routes_small_full.json')
output_file = os.path.join(data_dir, 'routes_small_full_with_eta_times.json')

with open(input_file, 'r', encoding='utf-8') as f:
    routes = json.load(f)

updated_routes = []

# --- Constants ---
AVG_SPEED_M_PER_MIN = 250  # ~15 km/h
START_HOUR = 7
START_MIN = 0

for route in routes:
    if not isinstance(route, dict) or 'stops' not in route or not isinstance(route['stops'], list):
        updated_routes.append(route)
        continue

    prev_lat, prev_lng = None, None
    current_time_min = START_HOUR * 60 + START_MIN

    for stop in route['stops']:
        if not isinstance(stop, dict):
            continue

        # Keep existing coords if valid
        coords = stop.get('coords')
        if coords and 'lat' in coords and 'lng' in coords:
            lat, lng = coords['lat'], coords['lng']
        else:
            # fallback to previous valid stop coords
            if prev_lat is not None and prev_lng is not None:
                lat, lng = prev_lat, prev_lng
            else:
                lat, lng = 0.0, 0.0  # first stop or missing data

        # Compute distance
        if prev_lat is not None and prev_lng is not None:
            distance = haversine(prev_lat, prev_lng, lat, lng)
            # Only override coords if distance is suspiciously big (>5km)
            if distance > 5000:
                lat, lng = prev_lat, prev_lng
                distance = 1.0
        else:
            distance = 0

        # Update stop
        stop['coords'] = {'lat': lat, 'lng': lng}
        stop['distance_from_prev_m'] = round(distance, 2)
        stop['eta_min'] = round(distance / AVG_SPEED_M_PER_MIN, 1) if distance > 0 else 0

        # Update time (at least 1 min increment)
        current_time_min += max(round(stop['eta_min']), 1)
        stop['time'] = f"{int(current_time_min//60):02d}:{int(current_time_min%60):02d}"

        # Save previous
        prev_lat, prev_lng = lat, lng

    updated_routes.append(route)

# --- Save ---
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(updated_routes, f, ensure_ascii=False, indent=2)

print(f"✅ Done! Distance + ETA + Time updated -> {output_file}")
