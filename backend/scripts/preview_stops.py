import json
import os

# --- Paths ---
data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
input_file = os.path.join(data_dir, 'routes_small_full_with_eta_times.json')

with open(input_file, 'r', encoding='utf-8') as f:
    routes = json.load(f)

count = 0
for route in routes:
    if 'stops' not in route or not isinstance(route['stops'], list):
        continue

    print(f"\n🚌 Route {route.get('number', 'N/A')} | {route.get('start', {}).get('hy','')} → {route.get('end', {}).get('hy','')}")
    for stop in route['stops']:
        count += 1
        name = stop.get('name', {}).get('hy', 'N/A') if isinstance(stop.get('name'), dict) else stop.get('name', 'N/A')
        dist = stop.get('distance_from_prev_m', 'N/A')
        eta = stop.get('eta_min', 'N/A')
        time = stop.get('time', 'N/A')
        print(f"   [ID:{stop.get('id','N/A')}] {name} | Distance: {dist} m | ETA: {eta} min | Time: {time}")
        if count >= 20:
            break
    if count >= 20:
        break

print("\n✅ First 20 stops preview complete.")
