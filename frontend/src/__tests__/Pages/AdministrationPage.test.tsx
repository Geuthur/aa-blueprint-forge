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
import AdministrationPage from "@/Pages/AdministrationPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/Api/ApiCalls", () => ({
  deleteAdministrationOwner: vi.fn(),
  loadAdministrationGroups: vi.fn(),
  loadAdministrationSettings: vi.fn(),
  loadUserData: vi.fn(),
  updateAdministrationSettings: vi.fn(),
  loadAdministrationOwners: vi.fn(),
  updateAdministrationOwner: vi.fn(),
  loadAdministrationOwnerBlueprints: vi.fn(),
  triggerAdministrationOwnerUpdate: vi.fn(),
  triggerAdministrationGlobalUpdate: vi.fn(),
}));

const mockUserData = (isSuperuser: boolean) => ({
  user: {
    user_id: 1,
    character_id: 1,
    character_name: "Admin",
    corporation_id: 1,
    corporation_name: "Corp",
    is_admin: true,
    is_superuser: isSuperuser,
    can_manage_orders: true,
    is_global_order_manager: true,
  },
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NuqsTestingAdapter hasMemory>
          <AdministrationPage />
        </NuqsTestingAdapter>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AdministrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ApiCalls.loadUserData).mockResolvedValue(mockUserData(false));
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue(mockSettings);
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue([]);
    vi.mocked(ApiCalls.updateAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [1, 2],
      order_status_group_ids: [2],
    });

    // Test Action
    renderPage();

    // Expected Result
    expect(await screen.findByText("Administration")).toBeInTheDocument();
    expect(screen.getByText("Global Notification Groups")).toBeInTheDocument();

    // Expand notification panel
    const toggleNotificationBtn = screen.getByTestId("toggle-notification-panel");
    await user.click(toggleNotificationBtn);

    const group1Checkboxes = await screen.findAllByLabelText("Industry Leaders");
    const group1Checkbox = group1Checkboxes[0];
    const group2Checkbox = (await screen.findAllByLabelText("Logistics Team"))[0];
    expect(group1Checkbox).toBeChecked();
    expect(group2Checkbox).not.toBeChecked();

    await user.click(group2Checkbox);

    const saveButton = screen.getByRole("button", { name: "Save Global Settings" });
    await user.click(saveButton);

    await waitFor(() => {
      expect(ApiCalls.updateAdministrationSettings).toHaveBeenCalledWith({
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.updateAdministrationOwner).mockResolvedValue({
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
      expect(ApiCalls.updateAdministrationOwner).toHaveBeenCalledWith(10, {
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue(mockGroups);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.loadAdministrationOwnerBlueprints).mockResolvedValue(mockOwnerBlueprints);

    // Test Action
    renderPage();

    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();

    const blueprintsBtn = screen.getByRole("button", { name: "Blueprints" });
    await user.click(blueprintsBtn);

    // Expected Result
    expect(await screen.findByText("Administration Inspection")).toBeInTheDocument();
    expect(await screen.findByText("Rifter Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Breacher Blueprint")).toBeInTheDocument();
    expect(ApiCalls.loadAdministrationOwnerBlueprints).toHaveBeenCalledWith(10);

    const backBtn = screen.getByRole("button", { name: "Back to Administration Overview" });
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.triggerAdministrationOwnerUpdate).mockResolvedValue({
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
      expect(ApiCalls.triggerAdministrationOwnerUpdate).toHaveBeenCalledWith(10, false);
    });
    expect(
      await screen.findByText("Update task queued for Enterprise Industrialists (force_refresh=False).")
    ).toBeInTheDocument();
  });

  it("should trigger force refresh task for superuser when selecting Force Refresh from dropdown", async () => {
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.loadUserData).mockResolvedValue(mockUserData(true));
    vi.mocked(ApiCalls.triggerAdministrationOwnerUpdate).mockResolvedValue({
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
      expect(ApiCalls.triggerAdministrationOwnerUpdate).toHaveBeenCalledWith(10, true);
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

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.deleteAdministrationOwner).mockResolvedValue({
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
      expect(ApiCalls.deleteAdministrationOwner).toHaveBeenCalledWith(10);
    });

    expect(
      await screen.findByText("Owner Enterprise Industrialists and all associated data deleted successfully.")
    ).toBeInTheDocument();
  });

  it("should filter owners by search term and filter button group", async () => {
    // Test Data
    const user = userEvent.setup();
    const mockMultiOwners = [
      {
        id: 1,
        name: "Character Crafter",
        is_corporation: false,
        character_id: 101,
        character_name: "Character Crafter",
        corporation_id: 98000001,
        corporation_name: "Crafter Corp",
        corporation_ticker: "CRFT",
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
      {
        id: 2,
        name: "Broken Corp",
        is_corporation: true,
        corporation_id: 98000002,
        corporation_name: "Broken Corp",
        corporation_ticker: "BRKN",
        status: "error",
        has_error: true,
        error_message: "Token expired",
        sections: [],
        is_public: false,
        public_type: "all",
        selective_bpo_enabled: false,
        blueprint_count: 0,
        bpo_count: 0,
        bpc_count: 0,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
      },
    ];

    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockMultiOwners);

    // Test Action
    renderPage();
    expect(await screen.findByText("Character Crafter")).toBeInTheDocument();
    expect(screen.getByText("Broken Corp")).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByRole("searchbox", { name: "Search owners" });
    await user.type(searchInput, "Broken");

    // Expected Result
    expect(screen.getByText("Broken Corp")).toBeInTheDocument();
    expect(screen.queryByText("Character Crafter")).not.toBeInTheDocument();

    // Clear search and click Issues filter
    await user.clear(searchInput);
    const issuesFilterBtn = screen.getByRole("button", { name: /Issues/i });
    await user.click(issuesFilterBtn);

    // Expected Result
    expect(screen.getByText("Broken Corp")).toBeInTheDocument();
    expect(screen.queryByText("Character Crafter")).not.toBeInTheDocument();
  });

  it("should trigger global update tasks for superuser with force refresh", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadUserData).mockResolvedValue(mockUserData(true));
    vi.mocked(ApiCalls.triggerAdministrationGlobalUpdate).mockResolvedValue({
      success: true,
      message: "Queued Update All Characters",
    });

    // Test Action
    renderPage();
    expect(await screen.findByText("Global Task Management")).toBeInTheDocument();
    expect(screen.getByText("Sync Issues")).toBeInTheDocument();

    // Expand collapsible panel
    const togglePanelBtn = screen.getByTestId("toggle-task-panel");
    await user.click(togglePanelBtn);

    // Toggle switch
    const switchEl = screen.getByLabelText(/Force Refresh ESI/i);
    await user.click(switchEl);

    // Click Update All Characters
    const updateCharsBtn = screen.getByTestId("update-all-characters-btn");
    await user.click(updateCharsBtn);

    // Expected Result 1
    await waitFor(() => {
      expect(ApiCalls.triggerAdministrationGlobalUpdate).toHaveBeenCalledWith({
        target: "characters",
        forceRefresh: true,
      });
    });

    // Click Update All Corporations
    vi.mocked(ApiCalls.triggerAdministrationGlobalUpdate).mockResolvedValue({
      success: true,
      message: "Queued Update All Corporations",
    });
    const updateCorpsBtn = screen.getByTestId("update-all-corporations-btn");
    await user.click(updateCorpsBtn);

    // Expected Result 2
    await waitFor(() => {
      expect(ApiCalls.triggerAdministrationGlobalUpdate).toHaveBeenCalledWith({
        target: "corporations",
        forceRefresh: true,
      });
    });
  });

  it("should hide global task panel and force refresh option for administrators without superuser", async () => {
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
    vi.mocked(ApiCalls.loadAdministrationGroups).mockResolvedValue([]);
    vi.mocked(ApiCalls.loadAdministrationSettings).mockResolvedValue({
      order_created_group_ids: [],
      order_status_group_ids: [],
    });
    vi.mocked(ApiCalls.loadAdministrationOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.loadUserData).mockResolvedValue(mockUserData(false));

    // Test Action
    renderPage();
    expect(await screen.findByText("Enterprise Industrialists")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More update options" }));

    // Expected Result
    expect(await screen.findByText("Normal Update")).toBeInTheDocument();
    expect(screen.queryByText("Force Refresh (Bypass Cache)")).not.toBeInTheDocument();
    expect(screen.queryByText("Global Task Management")).not.toBeInTheDocument();
  });
});
