// Third Party
import { describe, expect, it } from 'vitest';

// AA bpforge
import { queryKeys } from '@/Api/query';

describe('queryKeys', () => {
    it('provides static query keys', () => {
        expect(queryKeys.Menu).toEqual(['Menu']);
        expect(queryKeys.User).toEqual(['User']);
    });

    it('provides parameterized orders query keys with prefix support', () => {
        // Test Data
        const role = 'manage';

        // Test Action
        const rootKey = queryKeys.Orders();
        const roleKey = queryKeys.Orders(role);

        // Expected Result
        expect(rootKey).toEqual(['Orders']);
        expect(roleKey).toEqual(['Orders', 'manage']);
    });
});
