import { describe, expect, it } from "vitest";

import { MergeSchema } from "~/v1/merge/schema/MergeSchema";

describe("MergeSchema", () => {
	it("separates source actions from target effects", () => {
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "micro-forest",
				},
				action: "consume",
				effect: "keep",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "tag",
					tag: "tree",
				},
				action: "consume",
				effect: "remove",
			}).success,
		).toBe(true);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "use",
				effect: "replace",
				result: "double-tree",
			}).success,
		).toBe(true);
	});

	it("rejects ambiguous or incomplete target effects", () => {
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "consume",
				effect: "replace",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "consume",
				effect: "remove",
				result: "tree",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				target: {
					type: "item",
					itemId: "tree",
				},
				action: "keep",
				effect: "keep",
			}).success,
		).toBe(false);
		expect(
			MergeSchema.safeParse({
				action: "consume",
				effect: "remove",
			}).success,
		).toBe(false);
	});
});
