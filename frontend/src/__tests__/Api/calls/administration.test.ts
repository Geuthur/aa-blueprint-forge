// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    administrationQueryKeys,
    deleteAdministrationOwner,
    loadAdministrationGroups,
    loadAdministrationOwnerBlueprints,
    loadAdministrationOwners,
    loadAdministrationSettings,
    triggerAdministrationGlobalUpdate,
    triggerAdministrationOwnerUpdate,
    updateAdministrationOwner,
    updateAdministrationSettings,
} from '@/Api/calls/administration';
import { ProjectName } from '@/constants';

describe('administrationQueryKeys', () => {
    it('provides the administration keys', () => {
        expect(administrationQueryKeys.groups).toEqual(['AdministrationGroups']);
        expect(administrationQueryKeys.settings).toEqual(['AdministrationSettings']);
        expect(administrationQueryKeys.owners).toEqual(['AdministrationOwners']);
        expect(administrationQueryKeys.ownerBlueprints(1)).toEqual(['AdministrationOwnerBlueprints', 1]);
    });
});

describe('Administration API calls', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('settings and owners', () => {
        it('loadAdministrationGroups calls administration/groups/ endpoint', async () => {
            // Test Data
            const mockGroups = [{ id: 1, name: 'Admins' }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockGroups,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadAdministrationGroups();

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
            const result = await loadAdministrationSettings();

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
            const result = await updateAdministrationSettings(payload);

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
            const result = await loadAdministrationOwners();

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
            const result = await updateAdministrationOwner(1, payload);

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
            const result = await loadAdministrationOwnerBlueprints(1);

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
            const result = await triggerAdministrationOwnerUpdate(1);

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
            const result = await triggerAdministrationOwnerUpdate(1, true);

            // Expected Result
            expect(result).toEqual(mockResponse);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/administration/owners/{owner_id}/update/`, {
                params: { path: { owner_id: 1 } },
                body: { force_refresh: true },
            });
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
            const result = await deleteAdministrationOwner(42);

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
            await expect(deleteAdministrationOwner(42)).rejects.toThrow(
                'Failed to delete owner'
            );
        });
    });
});

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Every call of `Api/calls/administration.ts`: [name, HTTP method, call, fixed text]. */
const calls: [string, Method, () => Promise<unknown>, string][] = [
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
