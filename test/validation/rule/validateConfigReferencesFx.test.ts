import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import type { StartSchema } from "~/engine/start/schema/StartSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/engine/validation/schema/DiagnosticRecordEntityEnumSchema";

const compileItems = (
	items: Record<string, unknown>,
	start: StartSchema.Type = {
		currentSpace: 0,
		board: [],
		inventory: [],
		toolbar: [],
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
					code: DiagnosticCodeEnumSchema.enum.ConfigKeyIdMismatch,
					entity: DiagnosticRecordEntityEnumSchema.enum.Item,
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
					code: DiagnosticCodeEnumSchema.enum.ConfigKeyIdMismatch,
					entity: DiagnosticRecordEntityEnumSchema.enum.Category,
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
				currentSpace: 0,
				board: [
					{
						space: 0,
						itemId: "item:missing-start",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
				toolbar: [],
			},
		);
		const missing = result.diagnostics.filter(
			({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
		);

		expect(missing).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reference: DiagnosticRecordEntityEnumSchema.enum.Item,
					referenceId: "item:missing-start",
				}),
				expect.objectContaining({
					reference: DiagnosticRecordEntityEnumSchema.enum.Category,
					referenceId: "category:missing",
				}),
				expect.objectContaining({
					reference: DiagnosticRecordEntityEnumSchema.enum.Item,
					referenceId: "item:missing-input",
				}),
				expect.objectContaining({
					reference: DiagnosticRecordEntityEnumSchema.enum.Item,
					referenceId: "item:missing-output",
				}),
			]),
		);
	});
});
