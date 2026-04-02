import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PaymentStatusBadge } from "../../components/ui/payment-status-badge";

describe("PaymentStatusBadge", () => {
  it("normalizes pending label", () => {
    render(<PaymentStatusBadge status="pending" />);
    expect(screen.getByText("Menunggu Verifikasi")).toBeInTheDocument();
  });

  it("renders known statuses", () => {
    render(
      <div>
        <PaymentStatusBadge status="Belum bayar" />
        <PaymentStatusBadge status="Verifikasi" />
        <PaymentStatusBadge status="Lunas" />
      </div>
    );

    expect(screen.getByText("Belum bayar")).toBeInTheDocument();
    expect(screen.getByText("Verifikasi")).toBeInTheDocument();
    expect(screen.getByText("Lunas")).toBeInTheDocument();
  });

  it("renders fallback for unknown status", () => {
    render(<PaymentStatusBadge status="Custom Status" />);
    expect(screen.getByText("Custom Status")).toBeInTheDocument();
  });
});
