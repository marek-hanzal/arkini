import { afterEach, describe, expect, it, vi } from "vitest";
import { RandomServiceLive } from "~/random/logic/RandomServiceLive";

describe("RandomServiceLive", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("treats zero probability as impossible", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(RandomServiceLive.chance(0)).toBe(false);
	});

	it("treats full probability as guaranteed", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.999999);

		expect(RandomServiceLive.chance(1)).toBe(true);
	});

	it("rolls interior probabilities with an exclusive upper threshold", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.5);

		expect(RandomServiceLive.chance(0.5)).toBe(false);
		expect(RandomServiceLive.chance(0.500001)).toBe(true);
	});
});
