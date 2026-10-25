// React
import { MemoryRouter } from "react-router-dom";

// Third Party
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AA bpforge
import type { OwnerSettingSchema } from "@/Api/schema";
import { AdministrationErrorModal } from "@/Components/Administration";
import { AdministrationOwnersTable } from "@/Components/Administration/AdministrationOwnersTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.name ? key.replace("{{name}}", options.name) : key,
  }),
}));

const makeOwner = (overrides: Partial<OwnerSettingSchema> = {}): OwnerSettingSchema =>
  ({
    id: 1,
    name: "Test Pilot",
    is_corporation: false,
    is_public: false,
    public_type: "all",
    selective_bpo_enabled: false,
    notify_order_created_group_ids: [],
    notify_order_status_group_ids: [],
    blueprint_count: 0,
    bpo_count: 0,
    bpc_count: 0,
    status: "ok",
    has_error: false,
    error_message: null,
    sections: [],
    ...overrides,
  }) as OwnerSettingSchema;

const renderTable = (owners: OwnerSettingSchema[]) =>
  render(
    <MemoryRouter>
      <NuqsTestingAdapter hasMemory>
    <AdministrationOwnersTable
      owners={owners}
      isLoading={false}
      isError={false}
      updatingOwnerId={null}
      taskFeedback={null}
      onDismissFeedback={vi.fn()}
      onInspect={vi.fn()}
      onEdit={vi.fn()}
      isSuperuser={false}
      onTriggerUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
      </NuqsTestingAdapter>
    </MemoryRouter>
  );

describe("AdministrationErrorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show owner name, status and full message when shown", () => {
    // Test Data
    const onHide = vi.fn();

    // Test Action
    render(
      <AdministrationErrorModal
        show
        onHide={onHide}
        ownerName="Test Pilot"
        status="error"
        errorMessage="ESIException: something went wrong"
      />
    );

    // Expected Result
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Pilot")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("ESIException: something went wrong")).toBeInTheDocument();
  });

  it("should show default text when status is token_error without message", () => {
    // Test Data
    const onHide = vi.fn();

    // Test Action
    render(
      <AdministrationErrorModal
        show
        onHide={onHide}
        ownerName="Test Pilot"
        status="token_error"
        errorMessage={null}
      />
    );

    // Expected Result
    expect(
      screen.getByText(
        "The ESI token is invalid or expired. Re-add the character or corporation."
      )
    ).toBeInTheDocument();
  });

  it("should call onHide when the close button is clicked", async () => {
    // Test Data
    const user = userEvent.setup();
    const onHide = vi.fn();
    render(
      <AdministrationErrorModal
        show
        onHide={onHide}
        ownerName="Test Pilot"
        status="error"
        errorMessage="Boom"
      />
    );

    // Test Action
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[closeButtons.length - 1]);

    // Expected Result
    expect(onHide).toHaveBeenCalled();
  });
});

describe("AdministrationOwnersTable ESI status badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should open the error modal when the badge is clicked", async () => {
    // Test Data
    const user = userEvent.setup();
    renderTable([makeOwner({ status: "error", error_message: "Location lookup error" })]);

    // Test Action
    await user.click(screen.getByRole("button", { name: "Show error details for Test Pilot" }));

    // Expected Result
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Location lookup error")).toBeInTheDocument();
  });

  it("should open the error modal via keyboard Enter and Space", async () => {
    // Test Data
    const user = userEvent.setup();
    renderTable([makeOwner({ status: "error", error_message: "Keyboard error" })]);
    const badge = screen.getByRole("button", { name: "Show error details for Test Pilot" });

    // Test Action
    badge.focus();
    await user.keyboard("{Enter}");

    // Expected Result
    expect(screen.getByText("Keyboard error")).toBeInTheDocument();
  });

  it("should open the error modal with default text for token_error without message", async () => {
    // Test Data
    const user = userEvent.setup();
    renderTable([makeOwner({ status: "token_error", error_message: null })]);

    // Test Action
    await user.click(screen.getByRole("button", { name: "Show error details for Test Pilot" }));

    // Expected Result
    expect(
      screen.getByText(
        "The ESI token is invalid or expired. Re-add the character or corporation."
      )
    ).toBeInTheDocument();
  });

  it("should render a plain non-clickable badge when there is no error", () => {
    // Test Data
    renderTable([makeOwner({ status: "ok", error_message: null })]);

    // Test Action
    const badge = screen.getByText("ok");

    // Expected Result
    expect(badge).not.toHaveAttribute("role", "button");
    expect(
      screen.queryByRole("button", { name: "Show error details for Test Pilot" })
    ).not.toBeInTheDocument();
  });
});
