import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExonerateConceptCell } from "./ExonerateConceptCell";

/**
 * Lo que se perdona es la CUOTA: en un concepto en USD la celda debe hablar en dólares,
 * no en un monto en bolívares que depende de la tasa del día.
 */
describe("ExonerateConceptCell", () => {
  it("una cuota en USD exonerada se muestra en su moneda", () => {
    render(
      <ExonerateConceptCell
        conceptName="Mes de Septiembre"
        pendingVes={61030.21}
        pendingOriginal={75}
        currency="USD"
        exoneration={{ amount_ves: 61030.21, original_amount: 75, currency: "USD", reason: "hijo de personal" }}
      />,
    );
    expect(screen.getByText("Exonerado 75,00 USD")).toBeInTheDocument();
    // Los bolívares y el motivo quedan como referencia en el tooltip
    expect(screen.getByTitle(/61\.030,21 VES.*hijo de personal/)).toBeInTheDocument();
  });

  it("una cuota en VES se sigue mostrando en bolívares", () => {
    render(
      <ExonerateConceptCell
        conceptName="Mensualidad"
        pendingVes={1000}
        currency="VES"
        exoneration={{ amount_ves: 1000, original_amount: null, currency: "VES", reason: "beca" }}
      />,
    );
    expect(screen.getByText("Exonerado 1.000,00")).toBeInTheDocument();
  });

  it("sin exoneración ofrece el botón para aplicarla", () => {
    render(
      <ExonerateConceptCell conceptName="Mensualidad" pendingVes={1000} currency="VES" exoneration={null} />,
    );
    expect(screen.getByRole("button", { name: /Exonerar/ })).toBeInTheDocument();
  });

  it("una cuota sin pendiente no ofrece exonerar", () => {
    const { container } = render(
      <ExonerateConceptCell conceptName="Mensualidad" pendingVes={0} currency="VES" exoneration={null} />,
    );
    expect(container.textContent).toBe("—");
  });
});
