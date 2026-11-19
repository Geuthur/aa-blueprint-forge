// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    createOrder,
    deleteAdministrationOwner,
    deleteOrder,
    deleteOwner,
    fetchUserCharacterStatuses,
    loadAdministrationGroups,
    loadAdministrationOwnerBlueprints,
    loadAdministrationOwners,
    loadAdministrationSettings,
    loadCatalogBlueprints,
    loadMyBlueprints,
    loadOrder,
    loadOrders,
    loadOwnerBpos,
    loadPublicCatalogs,
    loadUserOwners,
    searchPublicBlueprints,
    triggerAdministrationGlobalUpdate,
    triggerAdministrationOwnerUpdate,
    triggerOwnerUpdate,
    triggerUpdateAllUserOwners,
    updateAdministrationOwner,
    updateAdministrationSettings,
    updateOrderStatus,
    updateOwnerBpos,
    updateOwnerSetting,
} from '@/Api/ApiCalls';
import { ProjectName } from '@/constants';

describe('General API client functions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadUserOwners', () => {
        it('returns owner settings from GET endpoint', async () => {
            const owners = [{ id: 1, name: 'Pilot 1', is_corporation: false, is_public: true, blueprint_count: 3 }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: owners,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await loadUserOwners();
            expect(result).toEqual(owners);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/settings/owners/`);
        });

        it('throws error when GET fails', async () => {
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: undefined,
                error: { status: 500 },
                response: new Response(),
            } as never);

            await expect(loadUserOwners()).rejects.toThrow('Failed to load owner settings');
        });
    });

    describe('updateOwnerSetting', () => {
        it('submits PATCH to update owner public status', async () => {
            const updated = { id: 1, name: 'Pilot 1', is_corporation: false, is_public: true };
            vi.spyOn(apiClient, 'PATCH').mockResolvedValueOnce({
                data: updated,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await updateOwnerSetting({ ownerId: 1, payload: { is_public: true } });
            expect(result).toEqual(updated);
            expect(apiClient.PATCH).toHaveBeenCalledWith(`/${ProjectName}/api/settings/owners/{owner_id}/`, {
                params: { path: { owner_id: 1 } },
                body: { is_public: true },
            });
        });

        it('throws error when PATCH fails', async () => {
            vi.spyOn(apiClient, 'PATCH').mockResolvedValueOnce({
                data: undefined,
                error: { status: 403 },
                response: new Response(),
            } as never);

            await expect(updateOwnerSetting({ ownerId: 1, payload: { is_public: true } })).rejects.toThrow('Failed to update owner setting');
        });
    });

    describe('Shop, Blueprints, and Orders API', () => {
        it('loadPublicShops calls blueprints/ endpoint', async () => {
            // Test Data
            const mockShops = [{ id: 1, name: 'Shop 1', is_corporation: false, blueprint_count: 5, bpo_count: 2, bpc_count: 3 }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockShops,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadPublicShops();

            // Expected Result
            expect(result).toEqual(mockShops);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/blueprints/`);
        });

        it('loadShopBlueprints calls owner blueprints endpoint with params', async () => {
            // Test Data
            const mockBps = [{ item_id: 101, type_name: 'Rifter Blueprint', is_original: true }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBps,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadShopBlueprints(1);

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
            const result = await (await import('@/Api/ApiCalls')).createOrder(payload);

            // Expected Result
            expect(result).toEqual(mockOrder);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/orders/`, {
                body: payload,
            });
        });

        it('loadOwnerBpos calls settings/owners/{owner_id}/bpos/ endpoint', async () => {
            // Test Data
            const mockBpos = [{ item_id: 101, type_id: 587, type_name: 'Rifter Blueprint', group_name: 'Blueprint', is_offered: true }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBpos,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadOwnerBpos(1);

            // Expected Result
            expect(result).toEqual(mockBpos);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/settings/owners/{owner_id}/bpos/`, {
                params: { path: { owner_id: 1 } },
            });
        });

        it('updateOwnerBpos submits offered items via POST', async () => {
            // Test Data
            const payload = [101, 102];
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: { success: true, count: 2 },
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).updateOwnerBpos(1, payload);

            // Expected Result
            expect(result).toEqual({ success: true, count: 2 });
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/settings/owners/{owner_id}/bpos/`, {
                params: { path: { owner_id: 1 } },
                body: { offered_item_ids: payload },
            });
        });

        it('loadAdministrationGroups calls administration/groups/ endpoint', async () => {
            // Test Data
            const mockGroups = [{ id: 1, name: 'Admins' }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockGroups,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadAdministrationGroups();

            // Expected Result
            expect(result).toEqual(mockGroups);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/administration/groups/`);
        });

        it('loadAdministrationSettings calls administration/settings/ endpoint', async () => {
            // Test Data
            const mockSettings = { order_created_group_ids: [1], order_status_group_ids: [2] };
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockSettings,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadAdministrationSettings();

            // Expected Result
            expect(result).toEqual(mockSettings);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/administration/settings/`);
        });

        it('updateAdministrationSettings submits settings via PUT', async () => {
            // Test Data
            const payload = { order_created_group_ids: [1], order_status_group_ids: [2] };
            vi.spyOn(apiClient, 'PUT').mockResolvedValueOnce({
                data: payload,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).updateAdministrationSettings(payload);

            // Expected Result
            expect(result).toEqual(payload);
            expect(apiClient.PUT).toHaveBeenCalledWith(`/${ProjectName}/api/administration/settings/`, {
                body: payload,
            });
        });

        it('loadAdministrationOwners calls administration/owners/ endpoint', async () => {
            // Test Data
            const mockOwners = [{ id: 1, name: 'Pilot 1', is_corporation: false }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockOwners,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadAdministrationOwners();

            // Expected Result
            expect(result).toEqual(mockOwners);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/`);
        });

        it('updateAdministrationOwner submits owner patch via PATCH', async () => {
            // Test Data
            const payload = { is_public: true, public_type: 'bpo' };
            const mockOwner = { id: 1, name: 'Pilot 1', is_public: true, public_type: 'bpo' };
            vi.spyOn(apiClient, 'PATCH').mockResolvedValueOnce({
                data: mockOwner,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).updateAdministrationOwner(1, payload);

            // Expected Result
            expect(result).toEqual(mockOwner);
            expect(apiClient.PATCH).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/{owner_id}/`, {
                params: { path: { owner_id: 1 } },
                body: payload,
            });
        });

        it('loadAdministrationOwnerBlueprints calls administration/owners/{owner_id}/blueprints/ endpoint', async () => {
            // Test Data
            const mockBps = [{ item_id: 101, type_name: 'Rifter Blueprint' }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBps,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadAdministrationOwnerBlueprints(1);

            // Expected Result
            expect(result).toEqual(mockBps);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/{owner_id}/blueprints/`, {
                params: { path: { owner_id: 1 } },
            });
        });

        it('triggerAdministrationOwnerUpdate submits update request with default force_refresh false', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Update task queued' };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).triggerAdministrationOwnerUpdate(1);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/{owner_id}/update/`, {
                params: { path: { owner_id: 1 } },
                body: { force_refresh: false },
            });
        });

        it('triggerAdministrationOwnerUpdate submits update request with force_refresh true', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Update task queued' };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).triggerAdministrationOwnerUpdate(1, true);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/{owner_id}/update/`, {
                params: { path: { owner_id: 1 } },
                body: { force_refresh: true },
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
            const result = await (await import('@/Api/ApiCalls')).searchPublicBlueprints('Rifter');

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
            await expect((await import('@/Api/ApiCalls')).searchPublicBlueprints('fail')).rejects.toThrow(
                'Failed to search public blueprints'
            );
        });
    });

    describe('deleteAdministrationOwner', () => {
        it('calls DELETE on administration owner endpoint and returns response', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Owner deleted.' };
            vi.spyOn(apiClient, 'DELETE').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).deleteAdministrationOwner(42);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.DELETE).toHaveBeenCalledWith(
                `/${ProjectName}/api/administration/owners/{owner_id}/`,
                {
                    params: { path: { owner_id: 42 } },
                }
            );
        });

        it('throws error when DELETE fails', async () => {
            // Test Data
            vi.spyOn(apiClient, 'DELETE').mockResolvedValueOnce({
                data: undefined,
                error: { status: 500 },
                response: new Response(),
            } as never);

            // Test Action & Expected Result
            await expect((await import('@/Api/ApiCalls')).deleteAdministrationOwner(42)).rejects.toThrow(
                'Failed to delete owner'
            );
        });
    });
});

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// [name, HTTP method, call, fixed text of the thrown error]
const calls: [string, Method, () => Promise<unknown>, string][] = [
    ['loadUserOwners', 'GET', () => loadUserOwners(), "Failed to load owner settings"],
    ['fetchUserCharacterStatuses', 'GET', () => fetchUserCharacterStatuses(), "Failed to load character update statuses"],
    ['updateOwnerSetting', 'PATCH', () => updateOwnerSetting({ ownerId: 1, payload: { is_public: true } }), "Failed to update owner setting"],
    ['triggerOwnerUpdate', 'POST', () => triggerOwnerUpdate(1), "Failed to trigger owner update task"],
    ['deleteOwner', 'DELETE', () => deleteOwner(1), "Failed to delete owner"],
    ['triggerUpdateAllUserOwners', 'POST', () => triggerUpdateAllUserOwners(), "Failed to trigger update all owners"],
    ['loadPublicCatalogs', 'GET', () => loadPublicCatalogs(), "Failed to load public catalogs"],
    ['loadCatalogBlueprints', 'GET', () => loadCatalogBlueprints(1), "Failed to load catalog blueprints"],
    ['searchPublicBlueprints', 'GET', () => searchPublicBlueprints('rifter'), "Failed to search public blueprints"],
    ['loadMyBlueprints', 'GET', () => loadMyBlueprints(), "Failed to load user blueprints"],
    ['createOrder', 'POST', () => createOrder({ owner_id: 1, items: [] }), "Failed to create order"],
    ['loadOrders', 'GET', () => loadOrders(), "Failed to load orders"],
    ['loadOrder', 'GET', () => loadOrder(1), "Failed to load order details"],
    ['updateOrderStatus', 'POST', () => updateOrderStatus(1, 'Accepted'), "Failed to update order status"],
    ['deleteOrder', 'DELETE', () => deleteOrder(1), "Failed to delete order"],
    ['loadOwnerBpos', 'GET', () => loadOwnerBpos(1), "Failed to load owner BPOs"],
    ['updateOwnerBpos', 'POST', () => updateOwnerBpos(1, [1]), "Failed to update offered BPOs"],
    ['loadAdministrationGroups', 'GET', () => loadAdministrationGroups(), "Failed to load Alliance Auth groups"],
    ['loadAdministrationSettings', 'GET', () => loadAdministrationSettings(), "Failed to load administration notification settings"],
    ['updateAdministrationSettings', 'PUT', () => updateAdministrationSettings({ order_created_group_ids: [], order_status_group_ids: [] }), "Failed to update administration notification settings"],
    ['loadAdministrationOwners', 'GET', () => loadAdministrationOwners(), "Failed to load all owners for administration"],
    ['updateAdministrationOwner', 'PATCH', () => updateAdministrationOwner(1, { is_public: true }), "Failed to update owner by administration"],
    ['loadAdministrationOwnerBlueprints', 'GET', () => loadAdministrationOwnerBlueprints(1), "Failed to load owner blueprints for administration"],
    ['triggerAdministrationOwnerUpdate', 'POST', () => triggerAdministrationOwnerUpdate(1), "Failed to trigger owner update task"],
    ['deleteAdministrationOwner', 'DELETE', () => deleteAdministrationOwner(1), "Failed to delete owner"],
    ['triggerAdministrationGlobalUpdate', 'POST', () => triggerAdministrationGlobalUpdate({ target: 'all' }), "Failed to trigger global update task"],
];

describe('API calls throw the message of the API', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe.each(calls)('%s', (_name, method, call, fixedText) => {
        const failWith = (error: unknown) =>
            vi.spyOn(apiClient, method).mockResolvedValueOnce({
                data: undefined,
                error,
                response: new Response(),
            } as never);

        it('should throw the message of the API when the request fails', async () => {
            // Test Data
            failWith({ error: 'Permission Denied' });

            // Test Action & Expected Result
            await expect(call()).rejects.toThrow('Permission Denied');
        });

        it('should throw the fixed text when the API sent no message', async () => {
            // Test Data
            failWith({});

            // Test Action & Expected Result
            await expect(call()).rejects.toThrow(fixedText);
        });
    });
});
