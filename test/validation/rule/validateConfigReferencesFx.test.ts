import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import type { StartSchema } from "~/v1/start/schema/StartSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const compileItems = (
	items: Record<string, unknown>,
	start: StartSchema.Type = {
		board: [],
		inventory: [],
	},
) =>
	Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items,
				start,
			}),
		]),
	);

describe("completed config reference validation", () => {
	it("reports canonical record key and embedded ID mismatches", async () => {
		const result = await compileItems({
			"item:key": createSimpleItem("item:embedded"),
		});

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "config:key-id-mismatch",
					entity: "item",
					key: "item:key",
					id: "item:embedded",
				}),
			]),
		);
	});

	it("reports category record key and embedded ID mismatches", async () => {
		const root = createRootSource();
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				{
					...root,
					value: {
						...root.value,
						categories: {
							"category:key": {
								id: "category:embedded",
								title: "Embedded",
							},
						},
					},
				},
			]),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "config:key-id-mismatch",
					entity: "category",
					key: "category:key",
					id: "category:embedded",
				}),
			]),
		);
	});

	it("reports missing start, category, selector, and output item references together", async () => {
		const producer = {
			...createProducerItem({
				id: "item:producer",
				input: [
					{
						type: "materials" as const,
						selector: {
							type: "item" as const,
							itemId: "item:missing-input",
						},
						quantity: {
							type: "value" as const,
							value: 1,
						},
						capacity: 0,
						mode: "consume" as const,
					},
				],
				output: createOutput([
					{
						itemId: "item:missing-output",
					},
				]),
			}),
			categoryId: "category:missing",
		};
		const result = await compileItems(
			{
				[producer.id]: producer,
			},
			{
				board: [
					{
						itemId: "item:missing-start",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		);
		const missing = result.diagnostics.filter(
			({ code }) => code === "config:missing-reference",
		);

		expect(missing).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reference: "item",
					referenceId: "item:missing-start",
				}),
				expect.objectContaining({
					reference: "category",
					referenceId: "category:missing",
				}),
				expect.objectContaining({
					reference: "item",
					referenceId: "item:missing-input",
				}),
				expect.objectContaining({
					reference: "item",
					referenceId: "item:missing-output",
				}),
			]),
		);
	});
});
