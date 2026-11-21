// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    deleteOwner,
    fetchUserCharacterStatuses,
    loadOwnerBpos,
    loadUserOwners,
    settingsQueryKeys,
    triggerOwnerUpdate,
    triggerUpdateAllUserOwners,
    updateOwnerBpos,
    updateOwnerSetting,
} from '@/Api/calls/settings';
import { ProjectName } from '@/constants';

describe('settingsQueryKeys', () => {
    it('provides the owner keys', () => {
        expect(settingsQueryKeys.owners).toEqual(['UserOwners']);
        expect(settingsQueryKeys.characterStatuses).toEqual(['UserCharacterStatuses']);
        expect(settingsQueryKeys.ownerBpos(1)).toEqual(['OwnerBpos', 1]);
    });
});

describe('Settings API calls', () => {
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

    describe('owner BPOs', () => {
        it('loadOwnerBpos calls settings/owners/{owner_id}/bpos/ endpoint', async () => {
            // Test Data
            const mockBpos = [{ item_id: 101, type_id: 587, type_name: 'Rifter Blueprint', group_name: 'Blueprint', is_offered: true }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBpos,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadOwnerBpos(1);

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
            const result = await updateOwnerBpos(1, payload);

            // Expected Result
            expect(result).toEqual({ success: true, count: 2 });
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/settings/owners/{owner_id}/bpos/`, {
                params: { path: { owner_id: 1 } },
                body: { offered_item_ids: payload },
            });
        });
    });
});

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Every call of `Api/calls/settings.ts`: [name, HTTP method, call, fixed text]. */
const calls: [string, Method, () => Promise<unknown>, string][] = [
    ['loadUserOwners', 'GET', () => loadUserOwners(), "Failed to load owner settings"],
    ['fetchUserCharacterStatuses', 'GET', () => fetchUserCharacterStatuses(), "Failed to load character update statuses"],
    ['updateOwnerSetting', 'PATCH', () => updateOwnerSetting({ ownerId: 1, payload: { is_public: true } }), "Failed to update owner setting"],
    ['triggerOwnerUpdate', 'POST', () => triggerOwnerUpdate(1), "Failed to trigger owner update task"],
    ['deleteOwner', 'DELETE', () => deleteOwner(1), "Failed to delete owner"],
    ['triggerUpdateAllUserOwners', 'POST', () => triggerUpdateAllUserOwners(), "Failed to trigger update all owners"],
    ['loadOwnerBpos', 'GET', () => loadOwnerBpos(1), "Failed to load owner BPOs"],
    ['updateOwnerBpos', 'POST', () => updateOwnerBpos(1, [1]), "Failed to update offered BPOs"],
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
