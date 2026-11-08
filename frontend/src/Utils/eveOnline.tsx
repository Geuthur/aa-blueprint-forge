// The shared image helpers (characterImageUrl, shipImageUrl, ...) come from aa-geuthur-react.
// This file only keeps the image server with the blueprint categories (bpo, bpc) of the app.

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
