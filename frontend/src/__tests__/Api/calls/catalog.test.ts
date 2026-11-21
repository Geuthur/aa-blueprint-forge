// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    catalogQueryKeys,
    createOrder,
    loadCatalogBlueprints,
    loadPublicCatalogs,
    searchPublicBlueprints,
} from '@/Api/calls/catalog';
import { ProjectName } from '@/constants';

describe('catalogQueryKeys', () => {
    it('provides the catalog keys', () => {
        expect(catalogQueryKeys.catalogs).toEqual(['PublicCatalogs']);
        expect(catalogQueryKeys.blueprints(1)).toEqual(['CatalogBlueprints', 1]);
        expect(catalogQueryKeys.search('Rifter')).toEqual(['SearchPublicBlueprints', 'Rifter']);
    });
});

describe('Catalog API calls', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('catalogs and orders', () => {
        it('loadPublicCatalogs calls blueprints/ endpoint', async () => {
            // Test Data
            const mockShops = [{ id: 1, name: 'Shop 1', is_corporation: false, blueprint_count: 5, bpo_count: 2, bpc_count: 3 }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockShops,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadPublicCatalogs();

            // Expected Result
            expect(result).toEqual(mockShops);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/blueprints/`);
        });

        it('loadCatalogBlueprints calls owner blueprints endpoint with params', async () => {
            // Test Data
            const mockBps = [{ item_id: 101, type_name: 'Rifter Blueprint', is_original: true }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBps,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadCatalogBlueprints(1);

            // Expected Result
            expect(result).toEqual(mockBps);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/blueprints/{owner_id}/`, {
                params: { path: { owner_id: 1 } },
            });
        });

        it('createOrder submits order payload via POST', async () => {
            // Test Data
            const payload = { owner_id: 1, note: 'Deliver to Jita', items: [{ blueprint_id: 101, quantity: 2 }] };
            const mockOrder = { id: 1, status: 'Pending', items: [] };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockOrder,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await createOrder(payload);

            // Expected Result
            expect(result).toEqual(mockOrder);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/orders/`, {
                body: payload,
            });
        });
    });

    describe('searchPublicBlueprints', () => {
        it('calls search endpoint with query parameter and returns data', async () => {
            // Test Data
            const mockBlueprints = [
                {
                    item_id: 101,
                    type_id: 587,
                    type_name: 'Rifter Blueprint',
                    owner_id: 1,
                    is_original: true,
                },
            ];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBlueprints,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await searchPublicBlueprints('Rifter');

            // Expected Result
            expect(result).toEqual(mockBlueprints);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/blueprints/search/`, {
                params: { query: { q: 'Rifter' } },
            });
        });

        it('throws error when search endpoint fails', async () => {
            // Test Data
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: undefined,
                error: { status: 500 },
                response: new Response(),
            } as never);

            // Test Action & Expected Result
            await expect(searchPublicBlueprints('fail')).rejects.toThrow(
                'Failed to search public blueprints'
            );
        });
    });
});

type Method = 'GET' | 'POST';

/** Every call of `Api/calls/catalog.ts`: [name, HTTP method, call, fixed text]. */
const calls: [string, Method, () => Promise<unknown>, string][] = [
    ['loadPublicCatalogs', 'GET', () => loadPublicCatalogs(), "Failed to load public catalogs"],
    ['loadCatalogBlueprints', 'GET', () => loadCatalogBlueprints(1), "Failed to load catalog blueprints"],
    ['searchPublicBlueprints', 'GET', () => searchPublicBlueprints('rifter'), "Failed to search public blueprints"],
    ['createOrder', 'POST', () => createOrder({ owner_id: 1, note: '', items: [] }), "Failed to create order"],
];

const failWith = (method: Method, error: unknown) =>
    vi.spyOn(apiClient, method).mockResolvedValueOnce({
        data: undefined,
        error,
        response: new Response(),
    } as never);

describe('API error messages', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe.each(calls)('%s', (_name, method, call, fixedText) => {
        it('throws the message of the API', async () => {
            // Test Data
            failWith(method, { error: 'Permission Denied' });

            // Test Action & Expected Result
            await expect(call()).rejects.toThrow('Permission Denied');
        });

        it('throws the fixed text when the API sends no message', async () => {
            // Test Data
            failWith(method, {});

            // Test Action & Expected Result
            await expect(call()).rejects.toThrow(fixedText);
        });
    });
});
