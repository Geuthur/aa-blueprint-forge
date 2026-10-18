// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    loadMenu,
    loadUserData,
    loadUserOwners,
    loadUserSettings,
    updateOwnerSetting,
    updateUserSettings,
} from '@/Api/ApiCalls';
import { ProjectName } from '@/configuration';

describe('General API client functions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadUserData', () => {
        it('returns user data on successful GET', async () => {
            const mockUser = { user_id: 1, character_id: 42, character_name: 'Test Pilot' };
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockUser,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await loadUserData();
            expect(result).toEqual({ user: mockUser });
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/user/`);
        });

        it('throws error when GET fails or returns no data', async () => {
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: undefined,
                error: { status: 500 },
                response: new Response(),
            } as never);

            await expect(loadUserData()).rejects.toThrow('Failed to load user data');
        });
    });

    describe('loadMenu', () => {
        it('calls menu endpoint and returns data', async () => {
            const mockMenu = { left_links: [], right_links: [] };
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockMenu,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await loadMenu();
            expect(result).toEqual(mockMenu);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/menu/`);
        });
    });

    describe('loadUserSettings', () => {
        it('returns settings from the typed GET endpoint', async () => {
            const settings = { disable_notifications: true };
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: settings,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await loadUserSettings();
            expect(result).toEqual(settings);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/settings/`);
        });
    });

    describe('updateUserSettings', () => {
        it('submits JSON to the typed PUT endpoint', async () => {
            const settings = { disable_notifications: true };
            vi.spyOn(apiClient, 'PUT').mockResolvedValueOnce({
                data: settings,
                error: undefined,
                response: new Response(),
            } as never);

            const result = await updateUserSettings(settings);
            expect(result).toEqual(settings);
            expect(apiClient.PUT).toHaveBeenCalledWith(`/${ProjectName}/api/settings/`, {
                body: settings,
            });
        });

        it('throws error when update fails', async () => {
            vi.spyOn(apiClient, 'PUT').mockResolvedValueOnce({
                data: undefined,
                error: { status: 403 },
                response: new Response(),
            } as never);

            await expect(updateUserSettings({ disable_notifications: false })).rejects.toThrow('Failed to update user settings');
        });
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

        it('loadSuperuserGroups calls superuser/groups/ endpoint', async () => {
            // Test Data
            const mockGroups = [{ id: 1, name: 'Admins' }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockGroups,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadSuperuserGroups();

            // Expected Result
            expect(result).toEqual(mockGroups);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/groups/`);
        });

        it('loadSuperuserSettings calls superuser/settings/ endpoint', async () => {
            // Test Data
            const mockSettings = { order_created_group_ids: [1], order_status_group_ids: [2] };
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockSettings,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadSuperuserSettings();

            // Expected Result
            expect(result).toEqual(mockSettings);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/settings/`);
        });

        it('updateSuperuserSettings submits settings via PUT', async () => {
            // Test Data
            const payload = { order_created_group_ids: [1], order_status_group_ids: [2] };
            vi.spyOn(apiClient, 'PUT').mockResolvedValueOnce({
                data: payload,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).updateSuperuserSettings(payload);

            // Expected Result
            expect(result).toEqual(payload);
            expect(apiClient.PUT).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/settings/`, {
                body: payload,
            });
        });

        it('loadSuperuserOwners calls superuser/owners/ endpoint', async () => {
            // Test Data
            const mockOwners = [{ id: 1, name: 'Pilot 1', is_corporation: false }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockOwners,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadSuperuserOwners();

            // Expected Result
            expect(result).toEqual(mockOwners);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/owners/`);
        });

        it('updateSuperuserOwner submits owner patch via PATCH', async () => {
            // Test Data
            const payload = { is_public: true, public_type: 'bpo' };
            const mockOwner = { id: 1, name: 'Pilot 1', is_public: true, public_type: 'bpo' };
            vi.spyOn(apiClient, 'PATCH').mockResolvedValueOnce({
                data: mockOwner,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).updateSuperuserOwner(1, payload);

            // Expected Result
            expect(result).toEqual(mockOwner);
            expect(apiClient.PATCH).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/owners/{owner_id}/`, {
                params: { path: { owner_id: 1 } },
                body: payload,
            });
        });

        it('loadSuperuserOwnerBlueprints calls superuser/owners/{owner_id}/blueprints/ endpoint', async () => {
            // Test Data
            const mockBps = [{ item_id: 101, type_name: 'Rifter Blueprint' }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBps,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).loadSuperuserOwnerBlueprints(1);

            // Expected Result
            expect(result).toEqual(mockBps);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/owners/{owner_id}/blueprints/`, {
                params: { path: { owner_id: 1 } },
            });
        });

        it('triggerSuperuserOwnerUpdate submits update request with default force_refresh false', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Update task queued' };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).triggerSuperuserOwnerUpdate(1);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/owners/{owner_id}/update/`, {
                params: { path: { owner_id: 1 } },
                body: { force_refresh: false },
            });
        });

        it('triggerSuperuserOwnerUpdate submits update request with force_refresh true', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Update task queued' };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).triggerSuperuserOwnerUpdate(1, true);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/superuser/owners/{owner_id}/update/`, {
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

    describe('deleteSuperuserOwner', () => {
        it('calls DELETE on superuser owner endpoint and returns response', async () => {
            // Test Data
            const mockResponse = { success: true, message: 'Owner deleted.' };
            vi.spyOn(apiClient, 'DELETE').mockResolvedValueOnce({
                data: mockResponse,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await (await import('@/Api/ApiCalls')).deleteSuperuserOwner(42);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.DELETE).toHaveBeenCalledWith(
                `/${ProjectName}/api/superuser/owners/{owner_id}/`,
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
            await expect((await import('@/Api/ApiCalls')).deleteSuperuserOwner(42)).rejects.toThrow(
                'Failed to delete owner'
            );
        });
    });
});



