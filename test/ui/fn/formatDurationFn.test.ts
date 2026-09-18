import { expect, it } from "vitest";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

it("keeps countdown tenths after splitting minutes, including trailing and terminal zero", () => {
	expect(formatDurationFn(110_900, "countdown")).toBe("1 min 50.9 s");
	expect(formatDurationFn(110_000, "countdown")).toBe("1 min 50.0 s");
	expect(formatDurationFn(0, "countdown")).toBe("0.0 s");
	expect(formatDurationFn(0)).toBe("Immediate");
});

it("carries rounded seconds into larger units instead of displaying sixty seconds", () => {
	expect(formatDurationFn(59_999, "countdown")).toBe("1 min 0.0 s");
	expect(formatDurationFn(3_599_999, "countdown")).toBe("1 h 0.0 s");
	expect(formatDurationFn(120_000)).toBe("2 min");
});
