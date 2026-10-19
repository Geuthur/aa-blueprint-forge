// React
import { MemoryRouter } from "react-router";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import SuperuserPage from "@/Pages/SuperuserPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/Api/ApiCalls", () => ({
  deleteSuperuserOwner: vi.fn(),
  loadSuperuserGroups: vi.fn(),
  loadSuperuserSettings: vi.fn(),
  updateSuperuserSettings: vi.fn(),
  loadSuperuserOwners: vi.fn(),
  updateSuperuserOwner: vi.fn(),
  loadSuperuserOwnerBlueprints: vi.fn(),
  triggerSuperuserOwnerUpdate: vi.fn(),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <SuperuserPage />
        </NuqsTestingAdapter>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("SuperuserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render global notification groups and allow updating them", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockGroups = [
      { id: 1, name: "Industry Leaders" },
      { id: 2, name: "Logistics Team" },
    ];
    const mockSettings = {
      order_created_group_ids: [1],
      order_status_group_ids: [2],
    };

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue(mockSettings);
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue([]);
    vi.mocked(ApiCalls.updateSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [1, 2],
      order_status_group_ids: [2],
    });

    // Test Action
    renderPage();

    // Expected Result
    expect(await screen.findByText("Superuser Administration")).toBeInTheDocument();
    expect(screen.getByText("Global Notification Groups")).toBeInTheDocument();

    const group1Checkboxes = await screen.findAllByLabelText("Industry Leaders");
    const group1Checkbox = group1Checkboxes[0];
    const group2Checkbox = (await screen.findAllByLabelText("Logistics Team"))[0];
    expect(group1Checkbox).toBeChecked();
    expect(group2Checkbox).not.toBeChecked();

    await user.click(group2Checkbox);

    const saveButton = screen.getByRole("button", { name: "Save Global Settings" });
    await user.click(saveButton);

    await waitFor(() => {
      expect(ApiCalls.updateSuperuserSettings).toHaveBeenCalledWith({
        order_created_group_ids: [1, 2],
        order_status_group_ids: [2],
      });
    });
  });

  it("should list all owners and open the edit modal", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockGroups = [{ id: 1, name: "Industry Leaders" }];
    const mockOwners = [
      {
        id: 10,
        name: "Enterprise Industrialists",
        is_corporation: true,
        character_id: null,
        character_name: null,
        corporation_id: 9876,
        corporation_name: "Enterprise Industrialists",
        corporation_ticker: "ENT",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "bpo",
        selective_bpo_enabled: true,
        notify_order_created_group_ids: [1],
        notify_order_status_group_ids: [],
        blueprint_count: 50,
        bpo_count: 50,
        bpc_count: 0,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-15 00:00",
        error_message: null,
        sections: [],
      },
    ];

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.updateSuperuserOwner).mockResolvedValue({
      ...mockOwners[0],
      public_type: "all",
    });

    // Test Action
    renderPage();

    // Expected Result
    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();
    expect(screen.getByText("bpo")).toBeInTheDocument();
    expect(screen.getByText("Selective")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: "Edit" });
    await user.click(editBtn);

    expect(await screen.findByText("Edit Owner Settings:")).toBeInTheDocument();

    const select = screen.getByDisplayValue("Only Originals (BPO)");
    await user.selectOptions(select, "all");

    const saveOwnerBtn = screen.getByRole("button", { name: "Save Owner Settings" });
    await user.click(saveOwnerBtn);

    await waitFor(() => {
      expect(ApiCalls.updateSuperuserOwner).toHaveBeenCalledWith(10, {
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: true,
        notify_order_created_group_ids: [1],
        notify_order_status_group_ids: [],
      });
    });
  });

  it("should open owner blueprints inspection view and display owner blueprints", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockGroups = [{ id: 1, name: "Industry Leaders" }];
    const mockOwners = [
      {
        id: 10,
        name: "Enterprise Industrialists",
        is_corporation: true,
        character_id: null,
        character_name: null,
        corporation_id: 9876,
        corporation_name: "Enterprise Industrialists",
        corporation_ticker: "ENT",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "bpo",
        selective_bpo_enabled: true,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 2,
        bpo_count: 1,
        bpc_count: 1,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-15 00:00",
        error_message: null,
        sections: [],
      },
    ];
    const mockOwnerBlueprints = [
      {
        item_id: 201,
        type_id: 688,
        type_name: "Rifter Blueprint",
        group_id: 105,
        group_name: "Frigate Blueprint",
        location_id: 60003760,
        location_name: "Jita IV - 4",
        material_efficiency: 10,
        time_efficiency: 20,
        runs: 0,
        quantity: 1,
        is_original: true,
        is_corp_bp: true,
        owner_id: 10,
        owner_name: "Enterprise Industrialists",
      },
      {
        item_id: 202,
        type_id: 689,
        type_name: "Breacher Blueprint",
        group_id: 105,
        group_name: "Frigate Blueprint",
        location_id: 60003760,
        location_name: "Jita IV - 4",
        material_efficiency: 9,
        time_efficiency: 18,
        runs: 10,
        quantity: 1,
        is_original: false,
        is_corp_bp: true,
        owner_id: 10,
        owner_name: "Enterprise Industrialists",
      },
    ];

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.loadSuperuserOwnerBlueprints).mockResolvedValue(mockOwnerBlueprints);

    // Test Action
    renderPage();

    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();

    const blueprintsBtn = screen.getByRole("button", { name: "Blueprints" });
    await user.click(blueprintsBtn);

    // Expected Result
    expect(await screen.findByText("Superuser Inspection")).toBeInTheDocument();
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Breacher Blueprint")).toBeInTheDocument();
    expect(ApiCalls.loadSuperuserOwnerBlueprints).toHaveBeenCalledWith(10);

    const backBtn = screen.getByRole("button", { name: "Back to Superuser Overview" });
    await user.click(backBtn);

    expect(await screen.findByText("All Blueprint Owners")).toBeInTheDocument();
  });

  it("should trigger normal update task when clicking the Update button", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockOwners = [
      {
        id: 10,
        name: "Enterprise Industrialists",
        is_corporation: true,
        corporation_id: 98000001,
        status: "ok",
        has_error: false,
        sections: [],
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        blueprint_count: 5,
        bpo_count: 3,
        bpc_count: 2,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
      },
    ];

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.triggerSuperuserOwnerUpdate).mockResolvedValue({
      success: true,
      message: "Update task queued for Enterprise Industrialists (force_refresh=False).",
    });

    // Test Action
    renderPage();

    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Update" });
    await user.click(updateBtn);

    // Expected Result
    await waitFor(() => {
      expect(ApiCalls.triggerSuperuserOwnerUpdate).toHaveBeenCalledWith(10, false);
    });
    expect(
      await screen.findByText("Update task queued for Enterprise Industrialists (force_refresh=False).")
    ).toBeInTheDocument();
  });

  it("should trigger force refresh task when selecting Force Refresh from dropdown", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockOwners = [
      {
        id: 10,
        name: "Enterprise Industrialists",
        is_corporation: true,
        corporation_id: 98000001,
        status: "ok",
        has_error: false,
        sections: [],
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        blueprint_count: 5,
        bpo_count: 3,
        bpc_count: 2,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
      },
    ];

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.triggerSuperuserOwnerUpdate).mockResolvedValue({
      success: true,
      message: "Update task queued for Enterprise Industrialists (force_refresh=True).",
    });

    // Test Action
    renderPage();

    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();

    const dropdownToggle = screen.getByRole("button", { name: "More update options" });
    await user.click(dropdownToggle);

    const forceRefreshItem = await screen.findByText("Force Refresh (Bypass Cache)");
    await user.click(forceRefreshItem);

    // Expected Result
    await waitFor(() => {
      expect(ApiCalls.triggerSuperuserOwnerUpdate).toHaveBeenCalledWith(10, true);
    });
    expect(
      await screen.findByText("Update task queued for Enterprise Industrialists (force_refresh=True).")
    ).toBeInTheDocument();
  });

  it("should open delete confirmation modal and delete owner when confirmed", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockOwners = [
      {
        id: 10,
        name: "Enterprise Industrialists",
        is_corporation: true,
        corporation_id: 98000001,
        status: "ok",
        has_error: false,
        sections: [],
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        blueprint_count: 5,
        bpo_count: 3,
        bpc_count: 2,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
      },
    ];

    vi.mocked(ApiCalls.loadSuperuserGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadSuperuserSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadSuperuserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.deleteSuperuserOwner).mockResolvedValue({
      success: true,
      message: "Owner Enterprise Industrialists and all associated data deleted successfully.",
    });

    // Test Action
    renderPage();

    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    // Expected Result: confirmation modal opens
    expect(await screen.findByText("Delete Owner")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete owner/i)
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(ApiCalls.deleteSuperuserOwner).toHaveBeenCalledWith(10);
    });

    expect(
      await screen.findByText("Owner Enterprise Industrialists and all associated data deleted successfully.")
    ).toBeInTheDocument();
  });
});

