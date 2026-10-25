// React
import { MemoryRouter } from "react-router-dom";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import MyBlueprintsPage from "@/Pages/MyBlueprintsPage";

describe("MyBlueprintsPage Component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it("renders KPI cards and blueprints table", async () => {
    // Test Data
    const mockBlueprints = [
      {
        item_id: 201,
        type_id: 688,
        type_name: "Rifter Blueprint",
        group_name: "Frigate Blueprint",
        is_original: true,
        is_corp_bp: false,
        quantity: 1,
        runs: null,
        material_efficiency: 10,
        time_efficiency: 20,
        location_id: 60003760,
        location_name: "Jita IV - 4",
        owner_id: 1,
        owner_name: "My Pilot",
      },
    ];
    vi.spyOn(ApiCalls, "loadMyBlueprints").mockResolvedValueOnce(mockBlueprints as never);

    // Test Action
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyBlueprintsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    expect(await screen.findByText("Personal & Corporation Blueprints")).toBeInTheDocument();
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Originals (BPO)")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Jita IV - 4")).toBeInTheDocument();
  });

  it("filters blueprints by originals (BPO) and copies (BPC) when clicking KPI cards", async () => {
    // Test Data
    const mockBlueprints = [
      {
        item_id: 201,
        type_id: 688,
        type_name: "Rifter Blueprint",
        group_name: "Frigate Blueprint",
        is_original: true,
        is_corp_bp: false,
        quantity: 1,
        runs: null,
        material_efficiency: 10,
        time_efficiency: 20,
        location_id: 60003760,
        location_name: "Jita IV - 4",
        owner_id: 1,
        owner_name: "My Pilot",
      },
      {
        item_id: 202,
        type_id: 593,
        type_name: "Tristan Blueprint",
        group_name: "Frigate Blueprint",
        is_original: false,
        is_corp_bp: false,
        quantity: 1,
        runs: 5,
        material_efficiency: 0,
        time_efficiency: 0,
        location_id: 60003760,
        location_name: "Jita IV - 4",
        owner_id: 1,
        owner_name: "My Pilot",
      },
    ];
    vi.spyOn(ApiCalls, "loadMyBlueprints").mockResolvedValueOnce(mockBlueprints as never);

    // Test Action
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <MyBlueprintsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial State: both items present
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Tristan Blueprint")).toBeInTheDocument();

    // Click "Originals (BPO)" card
    const bpoCard = screen.getByRole("button", { name: "Filter to show only Originals (BPO)" });
    fireEvent.click(bpoCard);

    // Only BPO shown
    await waitFor(() => {
      expect(screen.getByText("Rifter Blueprint")).toBeInTheDocument();
      expect(screen.queryByText("Tristan Blueprint")).toBeNull();
    });

    // Click "Copies (BPC)" card
    const bpcCard = screen.getByRole("button", { name: "Filter to show only Copies (BPC)" });
    fireEvent.click(bpcCard);

    // Only BPC shown
    await waitFor(() => {
      expect(screen.getByText("Tristan Blueprint")).toBeInTheDocument();
      expect(screen.queryByText("Rifter Blueprint")).toBeNull();
    });

    // Click "Total Blueprints" to reset to all
    const allCard = screen.getByRole("button", { name: "Show all blueprints" });
    fireEvent.click(allCard);

    // Both shown again
    await waitFor(() => {
      expect(screen.getByText("Rifter Blueprint")).toBeInTheDocument();
      expect(screen.getByText("Tristan Blueprint")).toBeInTheDocument();
    });
  });
});
