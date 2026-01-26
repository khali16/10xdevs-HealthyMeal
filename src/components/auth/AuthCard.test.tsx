import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthCard } from "./AuthCard";

describe("AuthCard", () => {
  it("renders title, description and footer", () => {
    render(
      <AuthCard
        title="Załóż konto"
        description="Utwórz konto, aby zapisywać przepisy i preferencje."
        footer={<span>Stopka</span>}
      >
        <div>Treść</div>
      </AuthCard>
    );

    expect(screen.getByText("Załóż konto")).toBeInTheDocument();
    expect(screen.getByText("Utwórz konto, aby zapisywać przepisy i preferencje.")).toBeInTheDocument();
    expect(screen.getByText("Treść")).toBeInTheDocument();
    expect(screen.getByText("Stopka")).toBeInTheDocument();
  });
});

