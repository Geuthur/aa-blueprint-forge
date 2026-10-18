// React
import { MemoryRouter } from "react-router";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import MainPage from "@/Pages/MainPage";

describe("MainPage Component", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

  const mockShops = [
    {
      id: 1,
      name: "Test Corp Blueprints",
      is_corporation: true,
      corporation_id: 98000001,
      blueprint_count: 10,
      bpo_count: 4,
      bpc_count: 6,
    },
    {
      id: 2,
      name: "Personal Blueprints",
      is_corporation: false,
      character_id: 95000001,
      blueprint_count: 5,
      bpo_count: 2,
      bpc_count: 3,
    },
  ];

  const mockBlueprints = [
    {
      item_id: 101,
      type_id: 688,
      type_name: "Rifter Blueprint",
      group_name: "Frigate Blueprint",
      is_original: true,
      is_corp_bp: true,
      quantity: 1,
      runs: null,
      material_efficiency: 10,
      time_efficiency: 20,
      location_id: 60003760,
      location_name: "Jita IV - 4",
      owner_id: 1,
      owner_name: "Test Corp Blueprints",
    },
  ];

  it("renders public blueprint catalog directory when no owner is selected", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter>
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    expect(await screen.findByText("Test Corp Blueprints")).toBeInTheDocument();
    expect(screen.getAllByText("Browse Blueprints")[0]).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Select Catalog" });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("");
  });

  it("opens owner blueprint catalog when clicking Browse Blueprints", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const browseBtns = await screen.findAllByText("Browse Blueprints");
    fireEvent.click(browseBtns[0]);

    // Expected Result
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Blueprints" })).toBeInTheDocument();
  });

  it("switches catalog via the select dropdown on the right header", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Test Corp Blueprints")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Select Catalog" });
    fireEvent.change(select, { target: { value: "1" } });

    // Expected Result
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
  });

  it("loads catalog directly when URL has catalog search param", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter searchParams="?catalog=1">
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Select Catalog" });
    expect(select).toHaveValue("1");
  });

  it("supports backward-compatible ?shop search param", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter searchParams="?shop=1">
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Select Catalog" });
    expect(select).toHaveValue("1");
  });

  it("renders top Review Order button next to Type filter when an item is selected", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter searchParams="?catalog=1">
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initial check: no top review order button
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.queryByTestId("top-review-order-btn")).toBeNull();

    // Select the blueprint item
    const selectBtn = screen.getByRole("button", { name: "Select" });
    fireEvent.click(selectBtn);

    // Expected Result
    const topBtn = await screen.findByTestId("top-review-order-btn");
    expect(topBtn).toBeInTheDocument();
    expect(topBtn.textContent).toContain("Review Order");
  });

  it("allows selecting catalog and initial filter type via clicking Total, BPO, or BPC on OwnerCard", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "loadCatalogBlueprints").mockResolvedValue(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    const totalPills = await screen.findAllByRole("button", { name: "Browse all blueprints" });
    expect(totalPills[0]).toBeInTheDocument();

    const bpoPills = screen.getAllByRole("button", { name: "Browse only Originals (BPO)" });
    expect(bpoPills[0]).toBeInTheDocument();

    const bpcPills = screen.getAllByRole("button", { name: "Browse only Copies (BPC)" });
    expect(bpcPills[0]).toBeInTheDocument();

    fireEvent.click(bpoPills[0]);
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
  });

  it("searches public blueprints when typing into the overview search input", async () => {
    // Test Data
    vi.spyOn(ApiCalls, "loadPublicCatalogs").mockResolvedValueOnce(mockShops as never);
    vi.spyOn(ApiCalls, "searchPublicBlueprints").mockResolvedValueOnce(mockBlueprints as never);
    const client = createQueryClient();

    // Test Action
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NuqsTestingAdapter hasMemory>
            <MainPage />
          </NuqsTestingAdapter>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText("Search catalogs or blueprints...");
    fireEvent.change(searchInput, { target: { value: "Rifter" } });

    // Expected Result
    expect(await screen.findByText("Test Corp Blueprints")).toBeInTheDocument();
    expect(await screen.findByText("Matching Blueprints (1)")).toBeInTheDocument();
    expect(screen.getByText("Rifter Blueprint")).toBeInTheDocument();
    expect(ApiCalls.searchPublicBlueprints).toHaveBeenCalledWith("Rifter");
  });
});
