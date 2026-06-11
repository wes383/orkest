import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/dictionary";

describe("translate() — ICU plural", () => {
  // We exercise the plural path through existing dictionary keys.
  it("renders table.filteredCount with =0 branch for empty results (en)", () => {
    const result = translate("en", "table.filteredCount", { count: 0 });
    expect(result).toBe("No items");
  });

  it("renders table.filteredCount with singular form (en)", () => {
    const result = translate("en", "table.filteredCount", { count: 1 });
    expect(result).toBe("1 item");
  });

  it("renders table.filteredCount with plural form (en)", () => {
    const result = translate("en", "table.filteredCount", { count: 12 });
    expect(result).toBe("12 items");
  });

  it("renders table.batch.selected with # placeholder (en)", () => {
    const result = translate("en", "table.batch.selected", { count: 3 });
    expect(result).toBe("3 selected");
  });

  it("returns the template unchanged when no values are passed", () => {
    const result = translate("en", "settings.view.table");
    expect(result).toBe("Table");
  });

  it("falls back to en for unknown locales", () => {
    const result = translate("fr", "settings.view.table");
    expect(result).toBe("Table");
  });

  it("preserves unresolved placeholders", () => {
    const result = translate("en", "table.filteredCount", { foo: 1 } as Record<string, number>);
    expect(result).toContain("{count}");
  });
});
