import { describe, expect, it } from "vitest";

import { MergeSchema } from "./MergeSchema";

describe("MergeSchema", () => {
	it("defines explicit keep, use, and consume merge variants", () => {
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "keep",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "use",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "tag",
					tag: "tree",
				},
				action: "consume",
				result: "tree",
			}).success,
		).toBe(true);
	});

	it("rejects ambiguous or incomplete merge variants", () => {
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "consume",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "keep",
				result: "tree",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "replace",
				result: "tree",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				action: "keep",
			}).success,
		).toBe(false);
	});
});
