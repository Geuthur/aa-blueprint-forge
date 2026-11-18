// React
import { useEffect, useState } from 'react';

// Third Party
// Voices of War
import { formatEveTime } from "aa-geuthur-react";

/**
 * Formats a numeric timestamp into an EVE Online time string (HH:MM:SS EVE)
 * @param date Timestamp in milliseconds
 * @returns Formatted EVE time string
 */
export function formatLastFetch(date?: number): string {
    if (!date) return '';
    return formatEveTime(new Date(date));
}

/**
 * Hook to manage the short ping animation whenever dataUpdatedAt changes
 * @param dataUpdatedAt Timestamp of the last query fetch
 * @param isBusy True if query is currently loading or refetching
 * @param duration Duration in milliseconds of the ping animation (default: 2000)
 */
export function useLivePing(
    dataUpdatedAt?: number,
    isBusy: boolean = false,
    duration: number = 2000
): boolean {
    const [pinging, setPinging] = useState(false);

    useEffect(() => {
        if (isBusy) return;

        const startTimer = setTimeout(() => setPinging(true), 0);
        const stopTimer = setTimeout(() => setPinging(false), duration);

        return () => {
            clearTimeout(startTimer);
            clearTimeout(stopTimer);
        };
    }, [dataUpdatedAt, isBusy, duration]);

    return pinging;
}
