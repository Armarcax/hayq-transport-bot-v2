import json
import sys
from collections import defaultdict

ROUTES_PATH = "backend/data/routes_small_full.json"


def load_routes(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    try:
        routes = load_routes(ROUTES_PATH)
    except Exception as e:
        print(f"ERROR: failed to read/parse JSON: {e}")
        sys.exit(2)

    if not isinstance(routes, list):
        print("ERROR: top-level JSON is not a list")
        sys.exit(2)

    summary = {
        'routes_total': len(routes),
        'routes_with_missing_keys': [],
        'stops_count_mismatch': [],
    }

    route_numbers = defaultdict(list)
    global_stop_ids = defaultdict(list)
    problems = []

    for idx, route in enumerate(routes):
        number = route.get('number')
        route_numbers[str(number)].append(idx)

        # required keys
        for key in ('start', 'end', 'stops_count', 'stops'):
            if key not in route:
                summary['routes_with_missing_keys'].append((idx, number, key))

        stops = route.get('stops') or []
        declared = route.get('stops_count')
        if declared is not None and declared != len(stops):
            summary['stops_count_mismatch'].append((idx, number, declared, len(stops)))

        for s_idx, stop in enumerate(stops):
            sid = stop.get('id')
            global_stop_ids[sid].append((idx, number, s_idx))
            # check stop id type
            if not isinstance(sid, int):
                problems.append(f"stop id not int: route_idx={idx} route={number} stop_index={s_idx} id={sid}")

            # check name languages
            name = stop.get('name')
            if not isinstance(name, dict) or not all(k in name for k in ('hy','ru','en')):
                problems.append(f"stop name missing languages: route={number} stop_id={sid}")

    # duplicates
    duplicate_route_numbers = {num: idxs for num, idxs in route_numbers.items() if len(idxs) > 1}
    duplicate_stop_ids = {sid: locs for sid, locs in global_stop_ids.items() if len(locs) > 1}

    # print report
    print("Validation report for:", ROUTES_PATH)
    print(f"- total routes: {summary['routes_total']}")
    if duplicate_route_numbers:
        print(f"- duplicate route numbers found: {len(duplicate_route_numbers)}")
        for num, idxs in duplicate_route_numbers.items():
            print(f"  * route number '{num}' appears in route indices: {idxs}")
    else:
        print("- no duplicate route numbers")

    if summary['routes_with_missing_keys']:
        print(f"- routes with missing keys: {len(summary['routes_with_missing_keys'])}")
        for r in summary['routes_with_missing_keys']:
            print(f"  * route index {r[0]} number={r[1]} missing key={r[2]}")

    if summary['stops_count_mismatch']:
        print(f"- stops_count mismatches: {len(summary['stops_count_mismatch'])}")
        for r in summary['stops_count_mismatch']:
            print(f"  * route index {r[0]} number={r[1]} declared={r[2]} actual={r[3]}")
    else:
        print("- all stops_count values match actual stops length")

    if duplicate_stop_ids:
        print(f"- duplicate stop ids found (global): {len(duplicate_stop_ids)}")
        # show up to 10 duplicates
        for sid, locs in list(duplicate_stop_ids.items())[:50]:
            print(f"  * stop id {sid} appears {len(locs)} times; examples: {locs[:5]}")
    else:
        print("- no duplicate stop ids found")

    if problems:
        print(f"- other problems found: {len(problems)}")
        for p in problems[:50]:
            print("  -", p)
    else:
        print("- no per-stop problems detected")

    # totals
    total_stop_entries = sum(len(route.get('stops') or []) for route in routes)
    unique_stop_ids = len(global_stop_ids)
    print(f"- total stop entries: {total_stop_entries}")
    print(f"- unique stop ids: {unique_stop_ids}")

    # exit code: 0 if no serious issues (duplicates or mismatches), 1 otherwise
    if duplicate_route_numbers or duplicate_stop_ids or summary['stops_count_mismatch'] or problems:
        print("\nSUMMARY: Validation finished with issues.")
        sys.exit(1)
    else:
        print("\nSUMMARY: Validation finished - no issues found.")
        sys.exit(0)


if __name__ == '__main__':
    main()
