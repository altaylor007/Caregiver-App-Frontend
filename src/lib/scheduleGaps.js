import { formatShift } from './timeUtils';

const GAP_WINDOW_START_MIN = 9 * 60 + 30; // 9:30am
const GAP_WINDOW_END_MIN = 21 * 60 + 30; // 9:30pm

export function timeToMinutes(isoStr) {
    if (!isoStr) return null;
    const hhmm = formatShift(isoStr, 'HH:mm');
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

export function formatMinutesLabel(mins) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 >= 12 ? 'pm' : 'am';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')}${period}`;
}

// shifts: array of objects each having start_time and end_time (raw
// timestamptz strings from the shifts table).
export function computeCoverageGaps(shifts) {
    const intervals = shifts
        .map((shift) => {
            let start = timeToMinutes(shift.start_time);
            let end = timeToMinutes(shift.end_time);
            if (start === null || end === null) return null;
            if (end <= start) end += 24 * 60; // overnight shift
            return [Math.max(start, GAP_WINDOW_START_MIN), Math.min(end, GAP_WINDOW_END_MIN)];
        })
        .filter((interval) => interval && interval[0] < interval[1])
        .sort((a, b) => a[0] - b[0]);

    const merged = [];
    intervals.forEach(([start, end]) => {
        const last = merged[merged.length - 1];
        if (last && start <= last[1]) {
            last[1] = Math.max(last[1], end);
        } else {
            merged.push([start, end]);
        }
    });

    const gaps = [];
    let cursor = GAP_WINDOW_START_MIN;
    merged.forEach(([start, end]) => {
        if (start > cursor) gaps.push([cursor, start]);
        cursor = Math.max(cursor, end);
    });
    if (cursor < GAP_WINDOW_END_MIN) gaps.push([cursor, GAP_WINDOW_END_MIN]);

    return gaps;
}
