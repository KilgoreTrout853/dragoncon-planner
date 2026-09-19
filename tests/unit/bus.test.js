// @vitest-environment node
/* The bus's two promises (src/bus.js): it refuses to draw before boot() has
   wired it, and once wired it calls straight through. New tests, not rows of
   tests/PORT-LEDGER.md, so their titles carry no harness line. The renderer
   is module state, so each test imports the module fresh. */
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("the render bus", () => {
  let bus;
  beforeEach(async () => {
    vi.resetModules();
    bus = await import("../../src/bus.js");
  });

  it("requestRender() throws until a renderer is registered", () => {
    expect(() => bus.requestRender()).toThrow(/before setRenderer/);
  });

  it("and once one is, it calls it then and there, not on a later tick", () => {
    let drawn = 0;
    bus.setRenderer(() => { drawn++; });
    bus.requestRender();
    expect(drawn).toBe(1);
    bus.requestRender();
    expect(drawn).toBe(2);
  });
});
