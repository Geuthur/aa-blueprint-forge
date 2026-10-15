// Third Party
import i18n from 'i18next';
import { ExternalLink } from 'lucide-react';

// AA bpforge
import { renderTooltip } from '@/Utils/bootsTrap';

export type ImageCategory =
    | 'bpo'
    | 'bpc'
    | 'characters'
    | 'corporations'
    | 'alliances'
    | 'item'
    | 'render';

export const ImageCategoryMap: Record<
    ImageCategory,
    { endpoint: 'characters' | 'corporations' | 'alliances' | 'types'; variant: string }
> = {
    bpo: { endpoint: 'types', variant: 'bp' },
    bpc: { endpoint: 'types', variant: 'bpc' },
    characters: { endpoint: 'characters', variant: 'portrait' },
    corporations: { endpoint: 'corporations', variant: 'logo' },
    alliances: { endpoint: 'alliances', variant: 'logo' },
    item: { endpoint: 'types', variant: 'icon' },
    render: { endpoint: 'types', variant: 'render' },
};

/**
 * Returns the URL for an image from CCP's image server.
 * Automatically chooses the correct endpoint and variant based on the category.
 *
 * @param category The category of the image ('characters', 'corporations', 'alliances', 'item', 'bpo', 'bpc', 'render')
 * @param id The entity or type ID
 * @param size The size of the image in pixels (defaults to 512)
 * @returns Complete URL of the image
 */
export function imageServer(
    category: ImageCategory,
    id: number,
    size: number = 512,
): string {
    const config = ImageCategoryMap[category] ?? { endpoint: 'types', variant: 'icon' };
    return `https://images.evetech.net/${config.endpoint}/${id}/${config.variant}?size=${size}`;
}

/**
 * @deprecated Use imageServer('render', shipTypeId, size)
 */
export const shipImageUrl = (shipTypeId: number, size: number = 512): string =>
    imageServer('render', shipTypeId, size);

/**
 * @deprecated Use imageServer('characters', characterId, size)
 */
export const characterImageUrl = (characterId: number, size: number = 512): string =>
    imageServer('characters', characterId, size);

/**
 * @deprecated Use imageServer('corporations', corporationId, size)
 */
export const corporationImageUrl = (corporationId: number, size: number = 128): string =>
    imageServer('corporations', corporationId, size);

/**
 * @deprecated Use imageServer('alliances', allianceId, size)
 */
export const allianceImageUrl = (allianceId: number, size: number = 128): string =>
    imageServer('alliances', allianceId, size);

/**
 * @deprecated Use imageServer('item', typeId, size)
 */
export const itemImageUrl = (typeId: number, size: number = 32): string =>
    imageServer('item', typeId, size);


/**
 * Returns the appropriate CSS classes for a given security status.
 * @param sec The security status of the solar system
 * @returns CSS classes for text color, background color, and border color
 */
export const getSecColor = (sec: number) => {
    if (sec >= 0.5) return 'aa-badge-hisec';
    if (sec > 0.0) return 'aa-badge-lowsec';
    return 'aa-badge-nullsec';
};

/**
 * Formats a Date object into EVE Online time string (HH:MM:SS EVE)
 * @param date The date to format (defaults to current date and time)
 * @returns Formatted EVE Online time string
 */
export const formatEveTime = (date: Date = new Date()): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} EVE`;
};

/**
 * Helper function for localized number formatting
 * @param value The number to format
 * @param unit Optional unit suffix (defaults to 'ISK')
 * @param locale Optional locale string (defaults to the current i18n language)
 * @param options Optional Intl.NumberFormatOptions for custom formatting
 */
export function formatNumber(
    value: number,
    unit: string = "ISK",
    locale?: string,
    options?: Intl.NumberFormatOptions
) {
    const effectiveLocale = locale || i18n.language || "de";
    const suffix = unit ? ` ${unit}` : "";
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B${suffix}`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K${suffix}`;
    const formatted = new Intl.NumberFormat(effectiveLocale, options).format(value);
    return unit ? `${formatted}${suffix}` : formatted;
}


/**
 * Formats a date relative to now (e.g. "in 15 Minuten", "vor 2 Stunden", "gestern")
 * using the native browser API Intl.RelativeTimeFormat.
 *
 * @param value The date string, timestamp or Date object to format
 * @returns Formatted relative time or "N/A" if value is missing/invalid
 */
export function formatRelativeTime(value?: string | Date | null): string {
    if (!value) {
        return "N/A";
    }

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
        return "N/A";
    }

    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);

    // Define intervals in seconds
    const intervals = [
        { unit: 'year', seconds: 31536000 },
        { unit: 'month', seconds: 2592000 },
        { unit: 'day', seconds: 86400 },
        { unit: 'hour', seconds: 3600 },
        { unit: 'minute', seconds: 60 },
        { unit: 'second', seconds: 1 },
    ] as const;

    const interval = intervals.find((i) => Math.abs(diffInSeconds) >= i.seconds) ?? intervals[intervals.length - 1];
    const count = Math.round(diffInSeconds / interval.seconds);

    const locale = i18n.language || "de";
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    return rtf.format(count, interval.unit);
}


/**
 * Generates a link to a specific killmail on zKillboard.
 * @param id The ID of the killmail
 * @param name The display name for the link
 * @returns A JSX element containing the link with a tooltip
 */
export function zKillboardLink({
    id,
    name,
    size = 12,
    className = "",
    externalLink = false
}: { id: number, name: string, size?: number, className?: string, externalLink?: boolean }) {
    const url = `https://zkillboard.com/kill/${id}/`;
    return renderTooltip(
        name,
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            {name}
            {externalLink && <ExternalLink size={size} />}
        </a>
    )
}

/**
 * Generates a finished Portrait for a character react component.
 * @param characterId The ID of the character
 * @param size The size of the image in pixels (defaults to 32)
 * @returns A React node containing the character portrait image
 */
export function renderCharacterPortrait(characterId: number, size: number = 32): React.ReactNode {
    return (
        <img src={`https://images.evetech.net/characters/${characterId}/portrait?size=${size}`} className="rounded" />
    );
}
