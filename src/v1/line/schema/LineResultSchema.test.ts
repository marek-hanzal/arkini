import { describe, expect, it } from "vitest";

import { LineResultSchema } from "./LineResultSchema";

describe("LineResultSchema", () => {
	it("accepts only concrete dynamic line properties", () => {
		const result = {
			enable: true,
			id: "line:wood",
			runtimeMs: 1_500,
			show: false,
		};

		expect(LineResultSchema.safeParse(result).success).toBe(true);
		expect(
			LineResultSchema.safeParse({
				...result,
				runtimeMs: 1.5,
			}).success,
		).toBe(false);
		expect(
			LineResultSchema.safeParse({
				...result,
				output: {},
			}).success,
		).toBe(false);
	});
});
