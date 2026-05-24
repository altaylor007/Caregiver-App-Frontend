import { formatInTimeZone, toZonedTime, getTimezoneOffset } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago';

/**
 * Get current time correctly formatted as a JavaScript Date
 * but shifted to represent Central Time's "local" time so that
 * libraries like date-fns can consume it properly as "today".
 * 
 * E.g., if it's 1:00 AM UTC on Mar 19, but 8:00 PM CT on Mar 18,
 * this returns a Date object corresponding to Mar 18.
 */
const getTodayInCentral = () => {
    return toZonedTime(new Date(), TIMEZONE);
};

/**
 * Creates a UTC ISO string from a date string and a time string,
 * treating the inputs as local to America/Chicago.
 * 
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} timeStr 'HH:mm' or 'HH:mm:ss'
 * @returns {string} UTC ISO string
 */
const createShiftIso = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '';
    try {
        const timeComponent = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        // Treat input explicitly as UTC to bypass browser local timezone
        const utcLiteral = `${dateStr}T${timeComponent}Z`;
        const nominalUtcDate = new Date(utcLiteral);

        // Calculate offset (in ms) of America/Chicago relative to UTC
        const offsetMs = getTimezoneOffset(TIMEZONE, nominalUtcDate);

        // Output UTC = Nominal UTC - Offset
        const actualUtcDate = new Date(nominalUtcDate.getTime() - offsetMs);
        if (isNaN(actualUtcDate.getTime())) return '';
        return actualUtcDate.toISOString();
    } catch (e) {
        return '';
    }
};

/**
 * Formats a UTC ISO string into a display string in America/Chicago time.
 * 
 * @param {string} isoStr Database ISO string 'YYYY-MM-DDTHH:mm:ss.SSSZ'
 * @param {string} fmt date-fns format string (e.g., 'h:mma', 'MMM do')
 * @returns {string} Formatted string
 */
const formatShift = (isoStr, fmt) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return formatInTimeZone(isoStr, TIMEZONE, fmt);
    } catch (e) {
        return '';
    }
};

const getHolidaysForYear = (year) => {
    const newYears = new Date(year, 0, 1);
    
    const memorialDay = new Date(year, 4, 31);
    memorialDay.setDate(31 - ((memorialDay.getDay() - 1 + 7) % 7));
    
    const independenceDay = new Date(year, 6, 4);
    
    const laborDay = new Date(year, 8, 1);
    laborDay.setDate(1 + ((8 - laborDay.getDay()) % 7));
    
    const thanksgiving = new Date(year, 10, 1);
    thanksgiving.setDate(1 + ((11 - thanksgiving.getDay()) % 7) + 21);
    
    const christmas = new Date(year, 11, 25);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    return [
        formatDate(newYears),
        formatDate(memorialDay),
        formatDate(independenceDay),
        formatDate(laborDay),
        formatDate(thanksgiving),
        formatDate(christmas)
    ];
};

export {
    TIMEZONE,
    getTodayInCentral,
    createShiftIso,
    formatShift,
    getHolidaysForYear,
};

