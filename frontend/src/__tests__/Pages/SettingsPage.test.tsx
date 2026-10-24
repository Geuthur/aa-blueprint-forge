// React
import { MemoryRouter } from "react-router";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import { SettingsPage } from "@/Pages/SettingsPage";

vi.mock("@/Api/ApiCalls", () => ({
  loadUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  loadUserOwners: vi.fn(),
  updateOwnerSetting: vi.fn(),
  triggerOwnerUpdate: vi.fn(),
  deleteOwner: vi.fn(),
  triggerUpdateAllUserOwners: vi.fn(),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/bpforge/settings/"]}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue([]);
  });

  it("should load the saved global notification preference", async () => {
    // Test Data
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValueOnce({
      disable_notifications: true,
    });

    // Test Action
    renderPage();

    // Expected Result
    expect(
      await screen.findByRole("switch", { name: "Disable all notifications" }),
    ).toBeChecked();
  });

  it("should save the global preference when the switch is enabled", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    vi.mocked(ApiCalls.updateUserSettings).mockResolvedValue({
      disable_notifications: true,
    });

    // Test Action
    renderPage();
    const toggle = await screen.findByRole("switch", {
      name: "Disable all notifications",
    });
    await user.click(toggle);

    // Expected Result
    expect(ApiCalls.updateUserSettings).toHaveBeenCalledWith(
      { disable_notifications: true },
      expect.any(Object),
    );
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it("should render linked owners and allow toggling public shop status via switch or row", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 1,
        name: "Test Character",
        is_corporation: false,
        character_id: 12345,
        character_name: "Test Character",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: "https://images.evetech.net/characters/12345/portrait",
        is_public: false,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 10,
        bpo_count: 4,
        bpc_count: 6,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [
          {
            section: "blueprints",
            section_name: "Blueprints",
            is_success: true,
            has_token_error: false,
            error_message: null,
            last_run_at: "2026-10-14 18:15",
            last_run_finished_at: "2026-10-14 18:20",
          },
          {
            section: "locations",
            section_name: "Locations",
            is_success: true,
            has_token_error: false,
            error_message: null,
            last_run_at: "2026-10-14 18:15",
            last_run_finished_at: "2026-10-14 18:20",
          },
        ],
      },
      {
        id: 2,
        name: "Test Corporation",
        is_corporation: true,
        character_id: 12345,
        character_name: "Sync Character",
        corporation_id: 67890,
        corporation_name: "Test Corporation",
        corporation_ticker: "CORP",
        alliance_id: null,
        portrait_url: "https://images.evetech.net/corporations/67890/logo",
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 25,
        bpo_count: 15,
        bpc_count: 10,
        status: "error",
        has_error: true,
        last_sync: "2026-10-14 17:00",
        error_message: "ESI connection timed out",
        sections: [
          {
            section: "blueprints",
            section_name: "Blueprints",
            is_success: false,
            has_token_error: false,
            error_message: "ESI connection timed out",
            last_run_at: "2026-10-14 17:00",
            last_run_finished_at: null,
          },
        ],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.updateOwnerSetting).mockResolvedValue({
      ...mockOwners[0],
      is_public: true,
    });

    // Test Action
    renderPage();

    // Expected Result
    expect(await screen.findByText("Test Character")).toBeInTheDocument();
    expect(screen.getByText("Test Corporation")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("Corporation")).toBeInTheDocument();

    // Verify ESI Status badges and sections
    expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("ESI connection timed out")).toBeInTheDocument();
    expect(screen.getAllByText("Blueprints").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Locations")).toBeInTheDocument();

    const charSwitch = screen.getByRole("switch", {
      name: "Toggle public shop for Test Character",
    });
    const corpSwitch = screen.getByRole("switch", {
      name: "Toggle public shop for Test Corporation",
    });

    expect(charSwitch).not.toBeChecked();
    expect(corpSwitch).toBeChecked();

    // Click the switch
    await user.click(charSwitch);

    expect(ApiCalls.updateOwnerSetting).toHaveBeenCalledWith(
      { ownerId: 1, payload: { is_public: true } },
      expect.any(Object),
    );
  });

  it("should allow toggling public shop by clicking the public row", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 1,
        name: "Test Character",
        is_corporation: false,
        character_id: 12345,
        character_name: "Test Character",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: null,
        is_public: false,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 10,
        bpo_count: 4,
        bpc_count: 6,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.updateOwnerSetting).mockResolvedValue({
      ...mockOwners[0],
      is_public: true,
    });

    // Test Action
    renderPage();
    const publicRow = (await screen.findByText("Public Shop")).closest('[role="button"]')!;
    expect(publicRow).toBeInTheDocument();
    await user.click(publicRow);

    // Expected Result
    expect(ApiCalls.updateOwnerSetting).toHaveBeenCalledWith(
      { ownerId: 1, payload: { is_public: true } },
      expect.any(Object),
    );
  });

  it("allows switching catalog public type via the ButtonGroup", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 1,
        name: "Test Character",
        is_corporation: false,
        character_id: 12345,
        character_name: "Test Character",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 10,
        bpo_count: 4,
        bpc_count: 6,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.updateOwnerSetting).mockResolvedValue({
      ...mockOwners[0],
      public_type: "bpo",
    });

    // Test Action
    renderPage();
    const bpoBtn = await screen.findByRole("button", { name: "BPO Only" });
    expect(bpoBtn).toBeInTheDocument();
    await user.click(bpoBtn);

    // Expected Result
    expect(ApiCalls.updateOwnerSetting).toHaveBeenCalledWith(
      { ownerId: 1, payload: { public_type: "bpo" } },
      expect.any(Object),
    );
  });

  it("should trigger update all owners when Update All button is clicked", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 1,
        name: "Test Character",
        is_corporation: false,
        character_id: 12345,
        character_name: "Test Character",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 5,
        bpo_count: 2,
        bpc_count: 3,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.triggerUpdateAllUserOwners).mockResolvedValue({
      success: true,
      message: "Queued updates for 1 owner(s).",
    });

    // Test Action
    renderPage();
    const updateAllBtn = await screen.findByRole("button", { name: /^Update All/i });
    expect(updateAllBtn).toBeInTheDocument();
    await user.click(updateAllBtn);

    // Expected Result
    expect(ApiCalls.triggerUpdateAllUserOwners).toHaveBeenCalledWith(false);
  });

  it("should trigger single owner update when Update button on card is clicked", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 42,
        name: "Test Pilot 42",
        is_corporation: false,
        character_id: 4242,
        character_name: "Test Pilot 42",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 5,
        bpo_count: 2,
        bpc_count: 3,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.triggerOwnerUpdate).mockResolvedValue({
      success: true,
      message: "Update task queued.",
    });

    // Test Action
    renderPage();
    const updateBtn = await screen.findByRole("button", { name: "Update Owner" });
    expect(updateBtn).toBeInTheDocument();
    await user.click(updateBtn);

    // Expected Result
    expect(ApiCalls.triggerOwnerUpdate).toHaveBeenCalledWith(42, false);
  });

  it("should open delete modal and call deleteOwner when confirmed", async () => {
    // Test Data
    const user = userEvent.setup();
    vi.mocked(ApiCalls.loadUserSettings).mockResolvedValue({
      disable_notifications: false,
    });
    const mockOwners = [
      {
        id: 99,
        name: "Delete Me Pilot",
        is_corporation: false,
        character_id: 9999,
        character_name: "Delete Me Pilot",
        corporation_id: 54321,
        corporation_name: "Test Corp",
        corporation_ticker: "TC",
        alliance_id: null,
        portrait_url: null,
        is_public: true,
        public_type: "all",
        selective_bpo_enabled: false,
        notify_order_created_group_ids: [],
        notify_order_status_group_ids: [],
        blueprint_count: 5,
        bpo_count: 2,
        bpc_count: 3,
        status: "ok",
        has_error: false,
        last_sync: "2026-10-14 18:20",
        error_message: null,
        sections: [],
      },
    ];
    vi.mocked(ApiCalls.loadUserOwners).mockResolvedValue(mockOwners);
    vi.mocked(ApiCalls.deleteOwner).mockResolvedValue({
      success: true,
      message: "Owner deleted.",
    });

    // Test Action
    renderPage();
    const deleteBtn = await screen.findByRole("button", { name: "Delete Owner" });
    await user.click(deleteBtn);

    const confirmBtn = await screen.findByRole("button", { name: "Confirm Delete" });
    expect(confirmBtn).toBeInTheDocument();
    await user.click(confirmBtn);

    // Expected Result
    expect(ApiCalls.deleteOwner).toHaveBeenCalledWith(99);
  });
});