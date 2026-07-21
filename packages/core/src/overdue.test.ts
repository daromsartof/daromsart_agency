import { describe, expect, it } from "vitest";
import { isOverdue } from "./overdue";

const DUE = new Date("2026-08-20T00:00:00.000Z");
const AFTER = new Date("2026-08-21T00:00:01.000Z");
const BEFORE = new Date("2026-08-20T12:00:00.000Z");

describe("isOverdue", () => {
  it("échue + impayée → en retard", () => {
    expect(
      isOverdue(
        { status: "sent", dueDate: DUE, totalCents: 10000, amountPaidCents: 0 },
        AFTER,
      ),
    ).toBe(true);
  });

  it("échue + payée intégralement → pas en retard", () => {
    expect(
      isOverdue(
        { status: "paid", dueDate: DUE, totalCents: 10000, amountPaidCents: 10000 },
        AFTER,
      ),
    ).toBe(false);
  });

  it("brouillon → jamais en retard, même échéance dépassée", () => {
    expect(
      isOverdue(
        { status: "draft", dueDate: DUE, totalCents: 10000, amountPaidCents: 0 },
        AFTER,
      ),
    ).toBe(false);
  });

  it("annulée → jamais en retard", () => {
    expect(
      isOverdue(
        { status: "cancelled", dueDate: DUE, totalCents: 10000, amountPaidCents: 0 },
        AFTER,
      ),
    ).toBe(false);
  });

  it("pas encore échue → pas en retard", () => {
    expect(
      isOverdue(
        { status: "sent", dueDate: DUE, totalCents: 10000, amountPaidCents: 0 },
        BEFORE,
      ),
    ).toBe(false);
  });

  it("sans échéance → pas en retard", () => {
    expect(
      isOverdue({ status: "sent", dueDate: null, totalCents: 10000, amountPaidCents: 0 }),
    ).toBe(false);
  });

  it("partiellement payée mais reste dû > 0 → en retard", () => {
    expect(
      isOverdue(
        { status: "partially_paid", dueDate: DUE, totalCents: 10000, amountPaidCents: 4000 },
        AFTER,
      ),
    ).toBe(true);
  });
});
