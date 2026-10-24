/** Returns the badge classes used for an ESI status. */
export const getEsiStatusBadgeClass = (status: string): string =>
  status === "ok"
    ? "aa-bg-success border border-success"
    : status === "token_error"
      ? "aa-bg-warning border border-warning"
      : "aa-bg-danger border border-danger";
