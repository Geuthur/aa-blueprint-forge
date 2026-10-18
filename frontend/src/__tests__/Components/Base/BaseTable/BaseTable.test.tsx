// React
import { MemoryRouter } from 'react-router';

// Third Party
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// AA bpforge
import { BaseTable } from '@/Components/Base/BaseTable';

describe('BaseTable Component', () => {
  const dummyColumns = [
    {
      header: 'Name',
      accessorKey: 'name',
    },
  ];

  it('renders loading spinner when isFetching is true and data is empty', () => {
    // Test Data
    const isFetching = true;
    const data: Array<{ name: string }> = [];

    // Test Action
    render(
      <MemoryRouter>
        <BaseTable
          data={data}
          columns={dummyColumns}
          isFetching={isFetching}
          emptyText="No items found"
        />
      </MemoryRouter>
    );

    // Expected Result
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    expect(screen.queryByText('No items found')).not.toBeInTheDocument();
  });

  it('renders empty message when not fetching and data is empty', () => {
    // Test Data
    const isFetching = false;
    const data: Array<{ name: string }> = [];

    // Test Action
    render(
      <MemoryRouter>
        <BaseTable
          data={data}
          columns={dummyColumns}
          isFetching={isFetching}
          emptyText="No items found"
        />
      </MemoryRouter>
    );

    // Expected Result
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders table rows when data is provided', () => {
    // Test Data
    const isFetching = false;
    const data = [{ name: 'Item One' }, { name: 'Item Two' }];

    // Test Action
    render(
      <MemoryRouter>
        <BaseTable
          data={data}
          columns={dummyColumns}
          isFetching={isFetching}
        />
      </MemoryRouter>
    );

    // Expected Result
    expect(screen.getByText('Item One')).toBeInTheDocument();
    expect(screen.getByText('Item Two')).toBeInTheDocument();
  });
});
