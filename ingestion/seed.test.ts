import { describe, expect, test } from "bun:test";
import { parseDevVars, parseShipArg } from "./seed";

describe("parseShipArg", () => {
  test("returns slug from --ship=<slug>", () => {
    expect(parseShipArg(["--ship=disney-fantasy"])).toBe("disney-fantasy");
  });

  test("returns slug from --ship <slug>", () => {
    expect(parseShipArg(["--ship", "disney-fantasy"])).toBe("disney-fantasy");
  });

  test("returns null when --ship is absent", () => {
    expect(parseShipArg([])).toBeNull();
    expect(parseShipArg(["--other=x"])).toBeNull();
  });

  test("returns null when --ship has no value", () => {
    expect(parseShipArg(["--ship"])).toBeNull();
    expect(parseShipArg(["--ship="])).toBeNull();
  });

  test("ignores other flags before --ship", () => {
    expect(parseShipArg(["--verbose", "--ship=foo"])).toBe("foo");
    expect(parseShipArg(["--verbose", "--ship", "foo"])).toBe("foo");
  });
});

describe("parseDevVars", () => {
  test("parses simple KEY=VALUE lines", () => {
    expect(parseDevVars("FOO=bar\nBAZ=qux")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  test("strips matching surrounding quotes", () => {
    expect(parseDevVars(`URL="postgres://x"\nALT='y'`)).toEqual({
      URL: "postgres://x",
      ALT: "y",
    });
  });

  test("does not strip mismatched or unmatched quotes", () => {
    expect(parseDevVars(`A="oops`)).toEqual({ A: `"oops` });
    expect(parseDevVars(`B='oops"`)).toEqual({ B: `'oops"` });
  });

  test("ignores blank lines and # comments", () => {
    const text = ["", "# comment", "FOO=bar", "  ", "# another", "BAZ=qux", ""].join(
      "\n",
    );
    expect(parseDevVars(text)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("handles values containing = signs", () => {
    expect(parseDevVars("DATABASE_URL=postgres://u:p=w@h/db")).toEqual({
      DATABASE_URL: "postgres://u:p=w@h/db",
    });
  });

  test("handles CRLF line endings", () => {
    expect(parseDevVars("FOO=bar\r\nBAZ=qux")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  test("ignores lines with no = or leading =", () => {
    expect(parseDevVars("noequals\n=novalue\nFOO=bar")).toEqual({ FOO: "bar" });
  });
});
