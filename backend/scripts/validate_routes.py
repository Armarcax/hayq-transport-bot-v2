import json
from collections import Counter
from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'data' / 'routes_small_full.json'

with p.open('r', encoding='utf-8') as f:
    data = json.load(f)

errors = []
route_numbers = []
stop_ids = []

for i, route in enumerate(data):
    rn = route.get('number')
    route_numbers.append(rn)
    # stops_count check
    stops = route.get('stops', [])
    sc = route.get('stops_count')
    if sc is None:
        errors.append(f"Route {rn}: missing 'stops_count'")
    else:
        if sc != len(stops):
            errors.append(f"Route {rn}: stops_count={sc} but actual stops={len(stops)}")

    for s in stops:
        sid = s.get('id')
        stop_ids.append(sid)
        # id type check
        if not isinstance(sid, int):
            errors.append(f"Route {rn}: stop id {sid!r} is not int")
        # name presence
        name = s.get('name')
        if not name or not isinstance(name, dict):
            errors.append(f"Route {rn}: stop id {sid}: missing or invalid 'name'")

# duplicates
rn_dups = [item for item, cnt in Counter(route_numbers).items() if cnt > 1]
if rn_dups:
    errors.append(f"Duplicate route numbers: {rn_dups}")

sid_counts = Counter(stop_ids)
dup_sids = [item for item, cnt in sid_counts.items() if cnt > 1]
if dup_sids:
    errors.append(f"Duplicate stop ids (global): {dup_sids}")

print('Validation results for', p)
if errors:
    print('FOUND ISSUES:')
    for e in errors:
        print(' -', e)
else:
    print('No issues found')

# quick summary
print('\nSummary:')
print(' Total routes:', len(data))
print(' Unique route numbers:', len(set(route_numbers)))
print(' Total stops entries:', len(stop_ids))
print(' Unique stop ids:', len(set(stop_ids)))
