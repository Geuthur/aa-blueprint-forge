// React
import { MemoryRouter } from 'react-router-dom';

// Third Party
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// AA bpforge
import * as ApiCalls from '@/Api/ApiCalls';
import { ProjectName } from '@/constants';
import AuthLeftMenu from '@/Menu/AuthLeftMenu';

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
        }),
    };
});

describe('AuthLeftMenu', () => {
    const createQueryClient = () =>
        new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

    it('should render internal navigation links', () => {
        // Test Data
        const testData = [
            { name: 'Dashboard', link: 'dashboard' },
            { name: 'Settings', link: '/settings/' },
        ];

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const dashboardLink = screen.getByText('Dashboard');
        expect(dashboardLink).toBeDefined();
        expect(dashboardLink.getAttribute('href')).toBe(`/${ProjectName}/dashboard/`);

        const settingsLink = screen.getByText('Settings');
        expect(settingsLink).toBeDefined();
        expect(settingsLink.getAttribute('href')).toBe(`/${ProjectName}/settings/`);
    });

    it('should render external links with standard href', () => {
        // Test Data
        const testData = [
            { name: 'External Docs', link: 'https://docs.example.com', is_external: true },
        ];

        // Test Action
        render(
            <MemoryRouter>
                <AuthLeftMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        const externalLink = screen.getByText('External Docs');
        expect(externalLink).toBeDefined();
        expect(externalLink.getAttribute('href')).toBe('https://docs.example.com');
    });

    it('should filter out items without links or handle empty list', () => {
        // Test Data
        const testData = [
            { name: 'No Link Category' },
        ];

        // Test Action
        const { container } = render(
            <MemoryRouter>
                <AuthLeftMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        expect(container.querySelectorAll('li')).toHaveLength(0);
    });

    it('should render Orders link without pulse or badge when seller has no open orders', async () => {
        // Test Data
        const testData = [{ name: 'Orders', link: '/orders/' }];
        vi.spyOn(ApiCalls, 'loadOrders').mockResolvedValueOnce([]);

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const ordersLink = await screen.findByText('Orders');
        expect(ordersLink).toBeDefined();
        expect(screen.queryByTestId('orders-badge')).toBeNull();
        expect(ordersLink.closest('a')?.classList.contains('aa-order-nav-pulse')).toBe(false);
    });

    it('should render Orders link with pulse and badge count when seller has open orders', async () => {
        // Test Data
        const testData = [{ name: 'Orders', link: '/orders/' }];
        const mockSellerOrders = [
            { id: 1, status: 'Pending' },
            { id: 2, status: 'Accepted' },
            { id: 3, status: 'Delivered' },
        ];
        vi.spyOn(ApiCalls, 'loadOrders').mockResolvedValueOnce(mockSellerOrders as never);

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const badge = await screen.findByTestId('orders-badge');
        expect(badge).toBeDefined();
        expect(badge.textContent).toBe('2');
        expect(badge.classList.contains('aa-order-badge')).toBe(true);

        const ordersLink = screen.getByText('Orders').closest('a');
        expect(ordersLink?.classList.contains('aa-order-nav-pulse')).toBe(true);
    });

    it('should render Settings link without pulse when all update statuses are ok', async () => {
        // Test Data
        const testData = [{ name: 'Settings', link: '/settings/' }];
        const mockOwners = [
            { id: 1, name: 'Pilot A', status: 'ok', has_error: false },
        ];
        vi.spyOn(ApiCalls, 'loadUserOwners').mockResolvedValueOnce(mockOwners as never);

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const settingsLink = await screen.findByRole('link', { name: /settings/i });
        expect(settingsLink).toBeDefined();
        await waitFor(() => {
            expect(within(settingsLink).queryByText(/^\d+$/)).toBeNull();
        });
    });

    it('should render pulsating issue badge on Settings link when an owner has an error', async () => {
        // Test Data
        const testData = [{ name: 'Settings', link: '/settings/' }];
        const mockOwners = [
            { id: 1, name: 'Pilot A', status: 'error', has_error: true },
        ];
        vi.spyOn(ApiCalls, 'loadUserOwners').mockResolvedValueOnce(mockOwners as never);

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const settingsLink = await screen.findByRole('link', { name: /settings/i });
        expect(settingsLink).toBeDefined();
        await waitFor(() => {
            expect(settingsLink.querySelector('.aa-danger-dot-core')).toBeNull();
            const badge = within(settingsLink).getByText('1');
            expect(badge.textContent).toBe('1');
            expect(badge.classList.contains('aa-menu-badge-pulse')).toBe(true);
        });
    });

    it('should render Administration link with red danger styling', async () => {
        // Test Data
        const testData = [{ name: 'Administration', link: '/administration/' }];

        // Test Action
        render(
            <QueryClientProvider client={createQueryClient()}>
                <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                    <AuthLeftMenu data={testData} isLoading={false} error={false} />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Expected Result
        const administrationLink = await screen.findByTestId('administration-nav-link');
        expect(administrationLink).toBeDefined();
        expect(administrationLink.classList.contains('aa-nav-danger')).toBe(true);
        expect(administrationLink.textContent).toContain('Administration');
    });
});
