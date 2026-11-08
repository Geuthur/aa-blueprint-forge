// React
import { MemoryRouter } from "react-router-dom";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useUserData } from "aa-geuthur-react";
import { describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import OrdersPage from "@/Pages/OrdersPage";

vi.mock("aa-geuthur-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("aa-geuthur-react")>()),
  useUserData: vi.fn(),
}));

describe("OrdersPage Component", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it("renders orders list and buyer/seller tabs", async () => {
    // Test Data
    const mockUser = { user_id: 1, character_id: 101, character_name: "Test Pilot" };
    const mockOrders = [
      {
        id: 1,
        owner_id: 2,
        owner_name: "Vendor Corp",
        requesting_user_id: 1,
        requesting_user_name: "Test Pilot",
        status: "Pending",
        note: "Deliver fast",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          {
            id: 1,
            blueprint_id: 101,
            type_id: 688,
            type_name: "Rifter Blueprint",
            quantity: 1,
            runs: 10,
            material_efficiency: 10,
            time_efficiency: 20,
            status: "Pending",
          },
        ],
      },
    ];
    vi.mocked(useUserData).mockReturnValue({ data: { user: mockUser } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockImplementation(async (role) => {
      if (role === "seller") {
        return mockOrders as never;
      }
      return mockOrders as never;
    });

    // Test Action
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    expect(await screen.findByText("Order #1")).toBeInTheDocument();
    expect(screen.getByText("My Orders (as Buyer)")).toBeInTheDocument();
    expect(screen.getByText("Catalog Orders (as Seller)")).toBeInTheDocument();
    const sellerBadge = await screen.findByTestId("seller-orders-badge");
    expect(sellerBadge).toBeInTheDocument();
    expect(sellerBadge.textContent).toBe("1");
  });

  it("displays pulsing seller tab and badge when open seller orders exist", async () => {
    // Test Data
    const mockUser = { user_id: 1, character_id: 101, character_name: "Test Pilot" };
    const mockSellerOrders = [
      { id: 10, status: "Pending", requesting_user_id: 99, owner_id: 1, items: [] },
      { id: 11, status: "Accepted", requesting_user_id: 99, owner_id: 1, items: [] },
      { id: 12, status: "Delivered", requesting_user_id: 99, owner_id: 1, items: [] },
    ];
    vi.mocked(useUserData).mockReturnValue({ data: { user: mockUser } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockImplementation(async (role) => {
      if (role === "seller") {
        return mockSellerOrders as never;
      }
      return [] as never;
    });

    // Test Action
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    const badge = await screen.findByTestId("seller-orders-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("2");
    expect(badge.classList.contains("aa-menu-badge-pulse")).toBe(true);
  });

  it("renders Order Management tab and badge when user is a manager", async () => {
    // Test Data
    const mockManagerUser = {
      user_id: 1,
      character_id: 101,
      character_name: "Admin Pilot",
      can_manage_orders: true,
      is_global_order_manager: true,
    };
    const mockManageOrders = [
      {
        id: 20,
        status: "Pending",
        requesting_user_id: 55,
        requesting_user_name: "Buyer Corp",
        owner_name: "Seller Shop",
        created_at: new Date().toISOString(),
        items: [],
      },
      {
        id: 21,
        status: "Accepted",
        requesting_user_id: 56,
        requesting_user_name: "Other Buyer",
        owner_name: "Other Shop",
        created_at: new Date().toISOString(),
        items: [],
      },
    ];
    vi.mocked(useUserData).mockReturnValue({ data: { user: mockManagerUser } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockImplementation(async (role) => {
      if (role === "manage") {
        return mockManageOrders as never;
      }
      return [] as never;
    });

    // Test Action
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    const manageTab = await screen.findByText("Order Management (Verwalter)");
    expect(manageTab).toBeInTheDocument();
    const manageBadge = await screen.findByTestId("manage-orders-badge");
    expect(manageBadge).toBeInTheDocument();
    expect(manageBadge.textContent).toBe("2");
  });

  const renderOrders = (url = "/") =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[url]}>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  const mockOrderOf = (status: string, requesterId: number, user: Record<string, unknown>) => {
    vi.mocked(useUserData).mockReturnValue({ data: { user: user } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockResolvedValue([
      {
        id: 99,
        status,
        requesting_user_id: requesterId,
        requesting_user_name: "Requester Pilot",
        owner_id: 2,
        owner_name: "Shop Corp",
        created_at: new Date().toISOString(),
        items: [],
      },
    ] as never);
  };

  it("allows a superuser to delete an order in the history via confirmation modal", async () => {
    // Test Data
    mockOrderOf("Delivered", 88, { user_id: 1, can_manage_orders: true, is_superuser: true });
    const deleteSpy = vi.spyOn(ApiCalls, "deleteOrder").mockResolvedValue({ success: true, message: "Deleted" });

    // Test Action
    renderOrders("/?tab=history");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Are you sure you want to permanently delete this order?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    // Expected Result
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(99);
    });
  });

  it("hides Delete for a manager who is no superuser", async () => {
    // Test Data
    mockOrderOf("Delivered", 88, { user_id: 1, can_manage_orders: true, is_superuser: false });

    // Test Action
    renderOrders("/?tab=history");
    await screen.findByText(/Shop Corp/);

    // Expected Result
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("hides Delete for a superuser outside of the history", async () => {
    // Test Data
    mockOrderOf("Pending", 88, { user_id: 1, can_manage_orders: true, is_superuser: true });

    // Test Action
    renderOrders("/?tab=manage");
    await screen.findByRole("button", { name: "Decline" });

    // Expected Result
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("offers Cancel only to the requester, also if the requester is a manager", async () => {
    // Test Data
    mockOrderOf("Pending", 1, { user_id: 1, can_manage_orders: true });

    // Test Action
    renderOrders("/?tab=manage");

    // Expected Result
    expect(await screen.findByRole("button", { name: "Cancel Order" })).toBeInTheDocument();
  });

  it("hides Cancel from a manager of a foreign order and shows Decline in red", async () => {
    // Test Data
    mockOrderOf("Pending", 88, { user_id: 1, can_manage_orders: true });

    // Test Action
    renderOrders("/?tab=manage");

    // Expected Result
    expect((await screen.findByRole("button", { name: "Decline" })).className).toContain("btn-danger");
    expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull();
  });

  it("loads closed orders in the history tab", async () => {
    // Test Data
    vi.mocked(useUserData).mockReturnValue({ data: { user: { user_id: 99 } } } as never);
    const loadOrders = vi.spyOn(ApiCalls, "loadOrders").mockResolvedValue([] as never);

    // Test Action
    renderOrders();
    fireEvent.click(await screen.findByRole("tab", { name: /History/ }));

    // Expected Result
    await waitFor(() => expect(loadOrders).toHaveBeenCalledWith("history"));
    expect(await screen.findByText("No closed orders found.")).toBeInTheDocument();
  });

  it("activates manage tab when URL query contains tab=manage", async () => {
    // Test Data
    const mockManagerUser = {
      user_id: 1,
      character_id: 101,
      character_name: "Admin Pilot",
      can_manage_orders: true,
      is_global_order_manager: true,
    };
    vi.mocked(useUserData).mockReturnValue({ data: { user: mockManagerUser } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockResolvedValue([] as never);

    // Test Action
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/orders/?tab=manage"]}>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    const manageTab = await screen.findByRole("tab", { name: /Order Management/i });
    expect(manageTab).toHaveAttribute("aria-selected", "true");
  });

  const orderWithItem = (locationName?: string | null, blueprintAvailable = true) => ({
    id: 20,
    owner_id: 2,
    owner_name: "Vendor Corp",
    requesting_user_id: 1,
    requesting_user_name: "Test Pilot",
    status: "Pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: 1,
        blueprint_id: 101,
        type_id: 688,
        type_name: "Rifter Blueprint",
        quantity: 1,
        runs: 10,
        material_efficiency: 10,
        time_efficiency: 20,
        location_name: locationName,
        blueprint_available: blueprintAvailable,
        status: "Pending",
      },
    ],
  });

  const renderExpandedOrder = async (locationName?: string | null, blueprintAvailable = true) => {
    vi.mocked(useUserData).mockReturnValue({ data: { user: { user_id: 1 } } } as never);
    vi.spyOn(ApiCalls, "loadOrders").mockResolvedValue([orderWithItem(locationName, blueprintAvailable)] as never);

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: /Items/ }));
    await screen.findByText("Rifter Blueprint");
  };

  it("shows the location of an order item", async () => {
    // Test Action
    await renderExpandedOrder("Jita IV - 4");

    // Expected Result
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Jita IV - 4")).toBeInTheDocument();
  });

  it("shows a placeholder for an order item without a known location name", async () => {
    // Test Action
    await renderExpandedOrder("");

    // Expected Result
    expect(screen.getByText("Unknown location")).toBeInTheDocument();
  });

  it("marks an order item whose blueprint is gone", async () => {
    // Test Action
    await renderExpandedOrder("Jita IV - 4", false);

    // Expected Result
    expect(screen.getByText("Blueprint no longer available")).toBeInTheDocument();
    expect(screen.getByText("Rifter Blueprint")).toBeInTheDocument();
  });

  it("does not mark an order item whose blueprint still exists", async () => {
    // Test Action
    await renderExpandedOrder("Jita IV - 4", true);

    // Expected Result
    expect(screen.queryByText("Blueprint no longer available")).toBeNull();
  });

  it("hides the location column when the API sends no location", async () => {
    // Test Action
    await renderExpandedOrder(null);

    // Expected Result
    expect(screen.queryByText("Location")).toBeNull();
  });
});
