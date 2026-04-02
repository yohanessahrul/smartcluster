import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TablePagination } from "../../components/ui/table-pagination";

describe("TablePagination", () => {
  it("shows current range and total items", () => {
    render(
      <TablePagination
        page={1}
        pageSize={10}
        totalItems={42}
        totalPages={5}
        from={1}
        to={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );

    expect(screen.getByText("Menampilkan 1-10 dari 42")).toBeInTheDocument();
    expect(screen.getByText("Hal 1 / 5")).toBeInTheDocument();
  });

  it("fires callbacks for next and page-size changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <TablePagination
        page={2}
        pageSize={10}
        totalItems={42}
        totalPages={5}
        from={11}
        to={20}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.selectOptions(screen.getByLabelText("Rows per page"), "50");
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
