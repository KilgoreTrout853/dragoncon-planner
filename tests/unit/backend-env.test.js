// @vitest-environment node
/* The build's guard on the backend it names (DECISIONS #53):
   dcBackendFromEnv() in build/vite-dc.js reads DC_SUPABASE_URL and
   DC_SUPABASE_KEY - both or neither - and refuses what a public page must
   not carry. And on whether it leaves the email step off (#99):
   dcEmailFromEnv() reads DC_EMAIL - "off", or nothing - and takes "off"
   only with a backend; dcBackend() defines all three. That the build runs
   it is tests/build.test.js's. New tests, not rows of tests/PORT-LEDGER.md. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { dcBackend, dcBackendFromEnv, dcEmailFromEnv } from "../../build/vite-dc.js";

const ADDRESS = "https://abcdefghijklmnopqrst.supabase.co", KEY = "sb_publishable_test-key";
/* A JWT's shape with the role given; its signature is never checked here. */
const jwt = role => ["header", Buffer.from(JSON.stringify({ iss: "supabase", role })).toString("base64url"), "signature"].join(".");
const env = (url, key) => ({ DC_SUPABASE_URL: url, DC_SUPABASE_KEY: key });

describe("dcBackendFromEnv", () => {
  it("neither: no backend, both empty", () => {
    expect(dcBackendFromEnv({})).toEqual({ url: "", key: "" });
    expect(dcBackendFromEnv(env(" ", ""))).toEqual({ url: "", key: "" });
  });
  it("both: the address, trimmed and without a trailing slash, and the key", () => {
    expect(dcBackendFromEnv(env(` ${ADDRESS}/ `, ` ${KEY} `))).toEqual({ url: ADDRESS, key: KEY });
  });
  it("one without the other is refused", () => {
    expect(() => dcBackendFromEnv(env(ADDRESS, ""))).toThrow(/go together/);
    expect(() => dcBackendFromEnv(env("", KEY))).toThrow(/go together/);
  });
  it("an address that is not https is refused, but for http on this machine", () => {
    expect(() => dcBackendFromEnv(env("http://abcdefghijklmnopqrst.supabase.co", KEY))).toThrow(/https/);
    expect(dcBackendFromEnv(env("http://127.0.0.1:54321", KEY)).url).toBe("http://127.0.0.1:54321");
    expect(dcBackendFromEnv(env("http://localhost:54321", KEY)).url).toBe("http://localhost:54321");
  });
  it("an address that is more than an origin, or none at all, is refused", () => {
    expect(() => dcBackendFromEnv(env(`${ADDRESS}/auth/v1`, KEY))).toThrow(/address and nothing more/);
    expect(() => dcBackendFromEnv(env(`${ADDRESS}?x=1`, KEY))).toThrow(/address and nothing more/);
    expect(() => dcBackendFromEnv(env("abcdefghijklmnopqrst.supabase.co", KEY))).toThrow(/address and nothing more/);
  });
  it("a secret key is refused, and the refusal never repeats it", () => {
    for (const secret of ["sb_secret_do-not-ship", jwt("service_role")]) {
      expect(() => dcBackendFromEnv(env(ADDRESS, secret))).toThrow(/secret key/);
      try { dcBackendFromEnv(env(ADDRESS, secret)); } catch (e) { expect(e.message).not.toContain(secret); }
    }
  });
  it("a public key passes, in either form", () => {
    expect(dcBackendFromEnv(env(ADDRESS, KEY)).key).toBe(KEY);
    expect(dcBackendFromEnv(env(ADDRESS, jwt("anon"))).key).toBe(jwt("anon"));
  });
});

describe("dcEmailFromEnv", () => {
  const withBackend = email => ({ ...env(ADDRESS, KEY), DC_EMAIL: email });

  it("unset, or blank: the email step is on wherever there is a backend", () => {
    expect(dcEmailFromEnv({})).toBe("");
    expect(dcEmailFromEnv(env(ADDRESS, KEY))).toBe("");
    expect(dcEmailFromEnv(withBackend(" "))).toBe("");
  });
  it("off, with a backend: the step is left off", () => {
    expect(dcEmailFromEnv(withBackend("off"))).toBe("off");
    expect(dcEmailFromEnv(withBackend(" off "))).toBe("off");
  });
  it("off with no backend is refused: it means something only with one", () => {
    expect(() => dcEmailFromEnv({ DC_EMAIL: "off" })).toThrow(/DC_EMAIL=off is for a build with a backend/);
  });
  it("any other value is refused, so a slip is not read as on", () => {
    for (const value of ["on", "OFF", "Off", "false", "0", "no", "none"]) {
      expect(() => dcEmailFromEnv(withBackend(value)), value).toThrow(/DC_EMAIL is off, or unset/);
    }
  });
  it("and a backend that is itself refused is refused here too", () => {
    expect(() => dcEmailFromEnv({ DC_SUPABASE_URL: ADDRESS, DC_EMAIL: "off" })).toThrow(/go together/);
  });
});

describe("dcBackend's defines", () => {
  afterEach(() => vi.unstubAllEnvs());
  const stub = (url, key, email) => { vi.stubEnv("DC_SUPABASE_URL", url); vi.stubEnv("DC_SUPABASE_KEY", key); vi.stubEnv("DC_EMAIL", email); };

  it("nothing set: the page holds three empty strings", () => {
    stub("", "", "");
    expect(dcBackend().config()).toEqual({ define: { __DC_SUPABASE_URL__: '""', __DC_SUPABASE_KEY__: '""', __DC_EMAIL__: '""' } });
  });
  it("a backend alone: its two, and the email step's still empty - on", () => {
    stub(ADDRESS, KEY, "");
    expect(dcBackend().config()).toEqual({ define: { __DC_SUPABASE_URL__: JSON.stringify(ADDRESS), __DC_SUPABASE_KEY__: JSON.stringify(KEY), __DC_EMAIL__: '""' } });
  });
  it("a backend with the step off: the page holds \"off\"", () => {
    stub(ADDRESS, KEY, "off");
    expect(dcBackend().config().define.__DC_EMAIL__).toBe('"off"');
  });
  it("off with no backend is refused as the config is read, before any work is done", () => {
    stub("", "", "off");
    expect(() => dcBackend().config()).toThrow(/DC_EMAIL=off/);
  });
});
