// Third Party
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// AA bpforge
import type { BlueprintItem } from '@/Components/BlueprintTable/BlueprintTableColumns';
import { OwnerCard } from '@/Components/Main/OwnerCard';

describe('OwnerCard Component', () => {
  const mockOwner = {
    id: 1,
    name: 'Industrial Syndicate',
    is_corporation: true,
    corporation_id: 98000001,
    blueprint_count: 12,
    bpo_count: 5,
    bpc_count: 7,
    has_errors: false,
  };

  const mockMatchingBlueprints: BlueprintItem[] = [
    {
      item_id: 501,
      type_id: 688,
      type_name: 'Rifter Blueprint',
      group_name: 'Frigate Blueprint',
      is_original: true,
      is_corp_bp: true,
      material_efficiency: 10,
      time_efficiency: 20,
      runs: undefined,
      quantity: 1,
      location_id: 60003760,
      location_name: 'Jita IV - 4',
      owner_id: 1,
      owner_name: 'Industrial Syndicate',
    },
    {
      item_id: 502,
      type_id: 689,
      type_name: 'Thrasher Blueprint',
      group_name: 'Destroyer Blueprint',
      is_original: false,
      is_corp_bp: true,
      material_efficiency: 10,
      time_efficiency: 20,
      runs: 10,
      quantity: 1,
      location_id: 60003760,
      location_name: 'Jita IV - 4',
      owner_id: 1,
      owner_name: 'Industrial Syndicate',
    },
  ];

  it('renders owner details and counts', () => {
    // Test Data
    const onSelect = vi.fn();

    // Test Action
    render(<OwnerCard owner={mockOwner} onSelect={onSelect} />);

    // Expected Result
    expect(screen.getByText('Industrial Syndicate')).toBeInTheDocument();
    expect(screen.getByText('Corporation Blueprints')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByTestId('matching-blueprints-list')).not.toBeInTheDocument();
  });

  it('renders matching blueprints list when prop is provided', () => {
    // Test Data
    const onSelect = vi.fn();

    // Test Action
    render(
      <OwnerCard
        owner={mockOwner}
        matchingBlueprints={mockMatchingBlueprints}
        onSelect={onSelect}
      />
    );

    // Expected Result
    const list = screen.getByTestId('matching-blueprints-list');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Matching Blueprints (2)')).toBeInTheDocument();
    expect(within(list).getByText('Rifter Blueprint')).toBeInTheDocument();
    expect(within(list).getByText('Thrasher Blueprint')).toBeInTheDocument();
    expect(within(list).getByText('BPO')).toBeInTheDocument();
    expect(within(list).getByText('BPC (10)')).toBeInTheDocument();
  });

  it('calls onSelect with owner and bpo type when clicking a matching BPO blueprint', () => {
    // Test Data
    const onSelect = vi.fn();
    render(
      <OwnerCard
        owner={mockOwner}
        matchingBlueprints={mockMatchingBlueprints}
        onSelect={onSelect}
      />
    );

    // Test Action
    const rifterItem = screen.getByText('Rifter Blueprint');
    fireEvent.click(rifterItem);

    // Expected Result
    expect(onSelect).toHaveBeenCalledWith(mockOwner, 'bpo');
  });

  it('calls onSelect with owner and bpc type when clicking a matching BPC blueprint', () => {
    // Test Data
    const onSelect = vi.fn();
    render(
      <OwnerCard
        owner={mockOwner}
        matchingBlueprints={mockMatchingBlueprints}
        onSelect={onSelect}
      />
    );

    // Test Action
    const thrasherItem = screen.getByText('Thrasher Blueprint');
    fireEvent.click(thrasherItem);

    // Expected Result
    expect(onSelect).toHaveBeenCalledWith(mockOwner, 'bpc');
  });

  it('renders pulsing warning indicator on Browse Blueprints button when owner has sync errors', () => {
    // Test Data
    const onSelect = vi.fn();
    const ownerWithErrors = {
      ...mockOwner,
      has_errors: true,
    };

    // Test Action
    render(<OwnerCard owner={ownerWithErrors} onSelect={onSelect} />);

    // Expected Result
    const browseButton = screen.getByRole('button', { name: /browse blueprints/i });
    expect(browseButton).toHaveClass('aa-btn-pulse');
    expect(browseButton.querySelector('.aa-pending-dot-container')).toBeInTheDocument();
  });
});
