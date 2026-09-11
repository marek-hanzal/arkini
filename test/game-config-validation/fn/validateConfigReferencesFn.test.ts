import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import type { StartSchema } from "~/game-start/schema/StartSchema";
import {
	createLine,
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";

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

const depositInput = (itemId: string) => ({
	type: "deposit" as const,
	query: {
		scope: "board" as const,
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemId,
		},
	},
	charges: {
		from: "target" as const,
		cost: 1,
	},
});

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

	it("reports missing start, selector, and output item references together", async () => {
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
							min: 1,
							max: 1,
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

	it("reports selectors authored by Space requirements and availability rules", async () => {
		const portal = {
			...createSimpleItem("item:portal"),
			type: "space" as const,
			space: 1,
			input: [
				depositInput("item:missing-deposit"),
			],
			rules: [
				{
					type: "enable" as const,
					when: [
						{
							type: "exists" as const,
							query: {
								scope: "universe" as const,
								selector: {
									type: "item" as const,
									itemId: "item:missing-rule",
								},
							},
						},
					],
				},
			],
		};
		const result = await compileItems({
			[portal.id]: portal,
		});
		const missing = result.diagnostics.filter(
			({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
		);
		expect(missing).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					referenceId: "item:missing-deposit",
				}),
				expect.objectContaining({
					referenceId: "item:missing-rule",
				}),
			]),
		);
	});

	it("preserves authored indices while validating every Line rule kind", async () => {
		const producer = createProducerItem({
			id: "item:producer",
			lines: [
				{
					...createLine({}),
					rules: [
						{
							type: "enable" as const,
							when: [
								{
									type: "exists" as const,
									query: {
										scope: "universe" as const,
										selector: {
											type: "item" as const,
											itemId: "item:producer",
										},
									},
								},
							],
						},
						{
							type: "show" as const,
							when: [
								{
									type: "exists" as const,
									query: {
										scope: "universe" as const,
										selector: {
											type: "item" as const,
											itemId: "item:missing-rule",
										},
									},
								},
							],
						},
					],
				},
			],
		});
		const result = await compileItems({
			[producer.id]: producer,
		});

		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				path: [
					"items",
					producer.id,
					"lines",
					0,
					"rules",
					1,
					"when",
					0,
					"query",
					"selector",
					"itemId",
				],
				referenceId: "item:missing-rule",
			}),
		);
	});
});
