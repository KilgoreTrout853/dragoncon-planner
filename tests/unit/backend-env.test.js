// @vitest-environment node
/* The build's guard on the backend it names (DECISIONS #53):
   dcBackendFromEnv() in build/vite-dc.js reads DC_SUPABASE_URL and
   DC_SUPABASE_KEY - both or neither - and refuses what a public page must
   not carry. That the build runs it is tests/build.test.js's. New tests, not
   rows of tests/PORT-LEDGER.md. */
import { describe, expect, it } from "vitest";
import { dcBackendFromEnv } from "../../build/vite-dc.js";

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
