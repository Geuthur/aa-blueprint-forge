// Third Party
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA bpforge
import { apiClient } from '@/Api/Api';
import {
    deleteOrder,
    loadOrder,
    loadOrders,
    ordersQueryKeys,
    updateOrderStatus,
} from '@/Api/calls/orders';
import { ProjectName } from '@/constants';

describe('ordersQueryKeys', () => {
    it('provides parameterized orders query keys with prefix support', () => {
        expect(ordersQueryKeys.orders()).toEqual(['Orders']);
        expect(ordersQueryKeys.orders('manage')).toEqual(['Orders', 'manage']);
        expect(ordersQueryKeys.order(1)).toEqual(['OrderDetail', 1]);
    });
});

describe('Orders API calls', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadOrders', () => {
        it('passes the role as query parameter', async () => {
            // Test Data
            const mockOrders = [{ id: 1, status: 'Pending', items: [] }];
            vi.spyOn(apiClient, 'GET').mockResolvedValueOnce({
                data: mockOrders,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await loadOrders('seller');

            // Expected Result
            expect(result).toEqual(mockOrders);
            expect(apiClient.GET).toHaveBeenCalledWith(`/${ProjectName}/api/orders/`, {
                params: { query: { role: 'seller' } },
            });
        });
    });

    describe('updateOrderStatus', () => {
        it('passes the order id as path parameter and the status as body', async () => {
            // Test Data
            const mockOrder = { id: 1, status: 'Accepted', items: [] };
            vi.spyOn(apiClient, 'POST').mockResolvedValueOnce({
                data: mockOrder,
                error: undefined,
                response: new Response(),
            } as never);

            // Test Action
            const result = await updateOrderStatus(1, 'Accepted');

            // Expected Result
            expect(result).toEqual(mockOrder);
            expect(apiClient.POST).toHaveBeenCalledWith(`/${ProjectName}/api/orders/{order_id}/status/`, {
                params: { path: { order_id: 1 } },
                body: { status: 'Accepted' },
            });
        });
    });
});

type Method = 'GET' | 'POST' | 'DELETE';

/** Every call of `Api/calls/orders.ts`: [name, HTTP method, call, fixed text]. */
const calls: [string, Method, () => Promise<unknown>, string][] = [
    ['loadOrders', 'GET', () => loadOrders(), "Failed to load orders"],
    ['loadOrder', 'GET', () => loadOrder(1), "Failed to load order details"],
    ['updateOrderStatus', 'POST', () => updateOrderStatus(1, 'Accepted'), "Failed to update order status"],
    ['deleteOrder', 'DELETE', () => deleteOrder(1), "Failed to delete order"],
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
