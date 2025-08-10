import sys


def parse_time_to_minutes(hhmm: str) -> int:
    hh, mm = map(int, hhmm.split(":"))
    return hh * 60 + mm


def get_night_windows(start_min: int, end_min: int):
    result = []
    day_start_idx = start_min // 1440 - 1
    day_end_idx = end_min // 1440 + 1
    for d in range(day_start_idx, day_end_idx + 1):
        night_start = d * 1440 + 22 * 60
        night_end = (d + 1) * 1440 + 8 * 60
        if night_end <= start_min or night_start >= end_min:
            continue
        a = max(start_min, night_start)
        b = min(end_min, night_end)
        if a < b:
            result.append((a, b))
    result.sort()
    return result


def normal_cost_for_intervals(start_min: int, end_min: int, covered_intervals):
    covered_intervals_sorted = sorted(covered_intervals)
    current = start_min
    cost = 0
    for a, b in covered_intervals_sorted:
        if current < a:
            length = a - current
            cost += ((length + 59) // 60) * 1000
        if b > current:
            current = b
    if current < end_min:
        length = end_min - current
        cost += ((length + 59) // 60) * 1000
    return cost


def solve_case(hhmm: str, duration_min: int) -> int:
    start = parse_time_to_minutes(hhmm)
    end = start + duration_min
    nights = get_night_windows(start, end)
    n = len(nights)
    best = ((duration_min + 59) // 60) * 1000
    for mask in range(1 << n):
        chosen = []
        count = 0
        for i in range(n):
            if mask & (1 << i):
                chosen.append(nights[i])
                count += 1
        total = count * 5000 + normal_cost_for_intervals(start, end, chosen)
        if total < best:
            best = total
    return best


def main():
    data = sys.stdin.read().strip().splitlines()
    if not data:
        return
    t = int(data[0].strip())
    out_lines = []
    for i in range(1, t + 1):
        line = data[i].strip()
        time_part, dur_part = line.split()
        d = int(dur_part)
        out_lines.append(str(solve_case(time_part, d)))
    sys.stdout.write("\n".join(out_lines))


if __name__ == "__main__":
    main()
