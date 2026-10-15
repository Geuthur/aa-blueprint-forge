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
      <BpoSelectionModal {...props} />
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
});
