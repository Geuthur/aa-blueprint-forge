// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    loadMyBlueprints,
    myBlueprintsQueryKeys,
} from '@/Api/calls/myBlueprints';
import { ProjectName } from '@/constants';

describe('myBlueprintsQueryKeys', () => {
    it('provides the blueprints key', () => {
        expect(myBlueprintsQueryKeys.blueprints).toEqual(['MyBlueprints']);
    });
});

describe('My Blueprints API calls', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadMyBlueprints', () => {
        it('returns the blueprints of the current user', async () => {
            // Test Data
            const mockBlueprints = [{ item_id: 101, type_name: 'Rifter Blueprint', is_original: true }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockBlueprints,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadMyBlueprints();

            // Expected Result
            expect(result).toEqual(mockBlueprints);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/my-blueprints/`);
        });
    });
});

type Method = 'GET';

/** Every call of `Api/calls/myBlueprints.ts`: [name, HTTP method, call, fixed text]. */
const calls: [string, Method, () => Promise<unknown>, string][] = [
    ['loadMyBlueprints', 'GET', () => loadMyBlueprints(), "Failed to load user blueprints"],
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
