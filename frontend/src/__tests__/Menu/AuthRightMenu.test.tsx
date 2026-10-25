// React
import { MemoryRouter } from 'react-router-dom';

// Third Party
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// AA bpforge
import { ProjectName } from '@/constants';
// AA Blueprint Shop
import AuthRightMenu from '@/Menu/AuthRightMenu';

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
        }),
    };
});

describe('AuthRightMenu', () => {
    it('should render internal navigation links for right menu', () => {
        // Test Data
        const testData = [
            { name: 'Admin', link: 'admin' },
        ];

        // Test Action
        render(
            <MemoryRouter initialEntries={[`/${ProjectName}/`]}>
                <AuthRightMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        const adminLink = screen.getByText('Admin');
        expect(adminLink).toBeDefined();
        expect(adminLink.getAttribute('href')).toBe(`/${ProjectName}/admin/`);
    });

    it('should render external links in right menu', () => {
        // Test Data
        const testData = [
            { name: 'GitHub Issues', link: 'https://github.com/example/issues', is_external: true },
        ];

        // Test Action
        render(
            <MemoryRouter>
                <AuthRightMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        const externalLink = screen.getByText('GitHub Issues');
        expect(externalLink).toBeDefined();
        expect(externalLink.getAttribute('href')).toBe('https://github.com/example/issues');
    });

    it('should render Add Character and Add Corporation action links', () => {
        // Test Data
        const testData = [
            { name: 'Add Character', link: '/bpforge/character/add/', is_external: true },
            { name: 'Add Corporation', link: '/bpforge/corporation/add/', is_external: true },
        ];

        // Test Action
        render(
            <MemoryRouter>
                <AuthRightMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        const addCharLink = screen.getByText('Add Character');
        expect(addCharLink).toBeDefined();
        expect(addCharLink.getAttribute('href')).toBe('/bpforge/character/add/');

        const addCorpLink = screen.getByText('Add Corporation');
        expect(addCorpLink).toBeDefined();
        expect(addCorpLink.getAttribute('href')).toBe('/bpforge/corporation/add/');
    });

    it('should filter out items without links', () => {
        // Test Data
        const testData = [
            { name: 'Category Only' },
        ];

        // Test Action
        const { container } = render(
            <MemoryRouter>
                <AuthRightMenu data={testData} isLoading={false} error={false} />
            </MemoryRouter>
        );

        // Expected Result
        expect(container.querySelectorAll('li')).toHaveLength(0);
    });
});
