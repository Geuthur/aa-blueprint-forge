// React
import { MemoryRouter } from "react-router-dom";

// Third Party
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AA bpforge
import * as ApiCalls from "@/Api/ApiCalls";
import { BpoSelectionModal } from "@/Components/Settings/BpoSelectionModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  withTranslation: () => (Component: unknown) => Component,
}));

vi.mock("@/Api/ApiCalls", () => ({
  loadOwnerBpos: vi.fn(),
  updateOwnerBpos: vi.fn(),
}));

const renderModal = (props: {
  show: boolean;
  onHide: () => void;
  ownerId: number;
  ownerName: string;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BpoSelectionModal {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("BpoSelectionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render BPOs, allow searching, toggling, and saving selection", async () => {
    // Test Data
    const user = userEvent.setup();
    const onHide = vi.fn();
    const mockBpos = [
      {
        item_id: 101,
        type_id: 601,
        type_name: "Atron Blueprint",
        group_name: "Frigate Blueprint",
        material_efficiency: 10,
        time_efficiency: 20,
        location_name: "Jita IV - 4",
        is_offered: false,
      },
      {
        item_id: 102,
        type_id: 602,
        type_name: "Catalyst Blueprint",
        group_name: "Destroyer Blueprint",
        material_efficiency: 9,
        time_efficiency: 18,
        location_name: "Amarr VIII",
        is_offered: true,
      },
    ];

    vi.mocked(ApiCalls.loadOwnerBpos).mockResolvedValue(mockBpos);
    vi.mocked(ApiCalls.updateOwnerBpos).mockResolvedValue({ success: true, count: 2 });

    // Test Action
    renderModal({
      show: true,
      onHide,
      ownerId: 5,
      ownerName: "Industrial Corp",
    });

    // Expected Result
    expect(await screen.findByText("Select Public BPOs")).toBeInTheDocument();
    expect(await screen.findByText("Atron Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Catalyst Blueprint")).toBeInTheDocument();

    const atronCheckbox = screen.getByLabelText("Select Atron Blueprint");
    const catalystCheckbox = screen.getByLabelText("Select Catalyst Blueprint");

    expect(atronCheckbox).not.toBeChecked();
    expect(catalystCheckbox).toBeChecked();

    // Toggle Atron to true
    await user.click(atronCheckbox);
    expect(atronCheckbox).toBeChecked();

    // Save selection
    const saveBtn = screen.getByRole("button", { name: "Save Selection" });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(ApiCalls.updateOwnerBpos).toHaveBeenCalledWith(
        5,
        expect.arrayContaining([101, 102])
      );
    });
    expect(onHide).toHaveBeenCalled();
  });

  it("should select and deselect all BPOs of a station with one click", async () => {
    // Test Data
    const user = userEvent.setup();
    const bpo = (item_id: number, type_name: string, location_name: string, is_offered = false) => ({
      item_id,
      type_id: item_id,
      type_name,
      group_name: "Frigate Blueprint",
      material_efficiency: 10,
      time_efficiency: 20,
      location_name,
      is_offered,
    });
    vi.mocked(ApiCalls.loadOwnerBpos).mockResolvedValue([
      bpo(101, "Atron Blueprint", "Jita IV - 4"),
      bpo(102, "Catalyst Blueprint", "Jita IV - 4", true),
      bpo(103, "Rifter Blueprint", "Amarr VIII"),
      bpo(104, "Thrasher Blueprint", ""),
    ]);

    // Test Action
    renderModal({ show: true, onHide: vi.fn(), ownerId: 5, ownerName: "Industrial Corp" });

    // Expected Result
    const jita = await screen.findByRole("checkbox", { name: "Jita IV - 4 (1 / 2)" });
    expect(jita).toBeInstanceOf(HTMLInputElement);
    expect((jita as HTMLInputElement).indeterminate).toBe(true);
    expect(jita).not.toBeChecked();

    // Stations are sorted, BPOs without a station come last
    const stationLabels = screen
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.getAttribute("id"))
      .filter((id) => id?.startsWith("bpo-station-"))
      .map((id) => document.querySelector(`label[for="${id}"]`)?.textContent);
    expect(stationLabels).toEqual([
      "Amarr VIII (0 / 1)",
      "Jita IV - 4 (1 / 2)",
      "Unknown location (0 / 1)",
    ]);

    // First click selects the rest of the station
    await user.click(jita);
    expect(screen.getByLabelText("Select Atron Blueprint")).toBeChecked();
    expect(screen.getByLabelText("Select Catalyst Blueprint")).toBeChecked();
    expect(screen.getByLabelText("Select Rifter Blueprint")).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Jita IV - 4 (2 / 2)" })).toBeChecked();

    // Second click deselects the whole station
    await user.click(screen.getByRole("checkbox", { name: "Jita IV - 4 (2 / 2)" }));
    expect(screen.getByLabelText("Select Atron Blueprint")).not.toBeChecked();
    expect(screen.getByLabelText("Select Catalyst Blueprint")).not.toBeChecked();

    // BPOs without a station can be selected as well
    await user.click(screen.getByRole("checkbox", { name: "Unknown location (0 / 1)" }));
    expect(screen.getByLabelText("Select Thrasher Blueprint")).toBeChecked();
  });

  it("should call onHide when Cancel button is clicked", async () => {
    // Test Data
    const user = userEvent.setup();
    const onHide = vi.fn();
    vi.mocked(ApiCalls.loadOwnerBpos).mockResolvedValue([]);

    // Test Action
    renderModal({
      show: true,
      onHide,
      ownerId: 5,
      ownerName: "Industrial Corp",
    });

    const cancelBtn = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);

    // Expected Result
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
