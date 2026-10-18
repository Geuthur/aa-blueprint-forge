// React
import { MemoryRouter } from "react-router";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import OrdersPage from "@/Pages/BlueprintPage";

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
    vi.spyOn(ApiCalls, "loadUserData").mockResolvedValue({ user: mockUser as never });
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
    vi.spyOn(ApiCalls, "loadUserData").mockResolvedValue({ user: mockUser as never });
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
    expect(badge.classList.contains("aa-order-badge")).toBe(true);

    const sellerTab = screen.getByText("Catalog Orders (as Seller)");
    expect(sellerTab.closest("button")?.classList.contains("aa-order-nav-pulse")).toBe(true);
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
    vi.spyOn(ApiCalls, "loadUserData").mockResolvedValue({ user: mockManagerUser as never });
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

  it("allows a manager to delete an order via confirmation modal", async () => {
    // Test Data
    const mockManagerUser = {
      user_id: 1,
      character_id: 101,
      character_name: "Admin Pilot",
      can_manage_orders: true,
      is_global_order_manager: true,
    };
    const mockOrders = [
      {
        id: 99,
        status: "Pending",
        requesting_user_id: 88,
        requesting_user_name: "Requester Pilot",
        owner_id: 2,
        owner_name: "Shop Corp",
        created_at: new Date().toISOString(),
        items: [],
      },
    ];
    vi.spyOn(ApiCalls, "loadUserData").mockResolvedValue({ user: mockManagerUser as never });
    vi.spyOn(ApiCalls, "loadOrders").mockResolvedValue(mockOrders as never);
    const deleteSpy = vi.spyOn(ApiCalls, "deleteOrder").mockResolvedValue({ success: true, message: "Deleted" });

    // Test Action
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <OrdersPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Expected Result
    const deleteBtn = await screen.findByRole("button", { name: /delete/i });
    expect(deleteBtn).toBeInTheDocument();

    // Click delete button to open modal
    fireEvent.click(deleteBtn);
    expect(await screen.findByText("Are you sure you want to permanently delete this order?")).toBeInTheDocument();

    // Click confirm delete
    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(99);
    });
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
    vi.spyOn(ApiCalls, "loadUserData").mockResolvedValue({ user: mockManagerUser as never });
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
});
