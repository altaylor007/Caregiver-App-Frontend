import { formatInTimeZone, toZonedTime, getTimezoneOffset } from 'date-fns-tz';

export const TIMEZONE = 'America/Chicago';

/**
 * Get current time correctly formatted as a JavaScript Date
 * but shifted to represent Central Time's "local" time so that
 * libraries like date-fns can consume it properly as "today".
 * 
 * E.g., if it's 1:00 AM UTC on Mar 19, but 8:00 PM CT on Mar 18,
 * this returns a Date object corresponding to Mar 18.
 */
export const getTodayInCentral = () => {
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
export const createShiftIso = (dateStr, timeStr) => {
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
export const formatShift = (isoStr, fmt) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        return formatInTimeZone(isoStr, TIMEZONE, fmt);
    } catch (e) {
        return '';
    }
};
