import { describe, expect, it } from "vitest";
import { authRedirect, isPublicPath, safeNext } from "@/lib/auth-routes";

describe("authRedirect", () => {
  it("sends logged-out visitors on any site page to /login", () => {
    for (const path of ["/", "/together", "/movie/769-goodfellas", "/person/1032", "/search"]) {
      expect(authRedirect(path, false)).toBe("/login");
    }
  });

  it("lets logged-out visitors reach the login and password pages", () => {
    for (const path of ["/login", "/signup", "/reset", "/update-password", "/auth/confirm"]) {
      expect(authRedirect(path, false)).toBeNull();
    }
  });

  it("sends logged-in people away from login and signup", () => {
    expect(authRedirect("/login", true)).toBe("/");
    expect(authRedirect("/signup", true)).toBe("/");
    expect(authRedirect("/together", true)).toBeNull();
  });

  it("never redirects API routes (the proxy answers them with 401)", () => {
    expect(authRedirect("/api/search", false)).toBeNull();
    expect(authRedirect("/api/person/1/details", false)).toBeNull();
  });

  it("doesn't treat look-alike paths as public", () => {
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/authors")).toBe(false);
  });
});

describe("safeNext", () => {
  it("keeps paths on this site, query included", () => {
    expect(safeNext("/together?ids=1032,380")).toBe("/together?ids=1032,380");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
