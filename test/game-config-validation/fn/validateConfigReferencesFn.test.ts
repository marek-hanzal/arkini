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
	createItemBase,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";

const compileItems = (
	items: Record<string, unknown>,
	start: StartSchema.Type = {
		currentSpace: 0,
		spaces: [],
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

const unitsInput = (itemUid: string) => ({
	type: "units" as const,
	query: {
		distance: "close" as const,
		selector: {
			type: "item" as const,
			itemUid,
		},
	},
	units: {
		from: "target" as const,
		cost: 1,
	},
});

describe("completed config reference validation", () => {
	it("reports canonical record key and embedded UID mismatches", async () => {
		const result = await compileItems({
			"item:key": createSimpleItem("item:embedded"),
		});

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ConfigKeyUidMismatch,
					entity: DiagnosticRecordEntityEnumSchema.enum.Item,
					key: "item:key",
					uid: "item:embedded",
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
						query: {
							distance: "far",
							selector: {
								type: "item" as const,
								itemUid: "item:missing-input",
							},
						},
						quantity: {
							min: 1,
							max: 1,
						},
						mode: "consume" as const,
					},
				],
				outcome: createOutput([
					{
						itemUid: "item:missing-output",
					},
				]),
			}),
		};
		const result = await compileItems(
			{
				[producer.uid]: producer,
			},
			{
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "template:missing",
					},
				],
			},
		);
		const missing = result.diagnostics.filter(
			({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
		);

		expect(missing).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reference: DiagnosticRecordEntityEnumSchema.enum.Template,
					referenceId: "template:missing",
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
			...createItemBase("item:portal"),

			lines: [
				createLine({
					default: true,
					input: [
						unitsInput("item:missing-units"),
					],
					outcome: {
						set: [
							{
								weight: 1,
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "space",
												space: 1,
												rules: [
													{
														type: "enable" as const,
														when: [
															{
																type: "exists" as const,
																query: {
																	distance: "far",
																	selector: {
																		type: "item" as const,
																		itemUid:
																			"item:missing-rule",
																	},
																},
															},
														],
													},
												],
											},
										],
									},
								],
							},
						],
					},
				}),
			],
		};
		const result = await compileItems({
			[portal.uid]: portal,
		});
		const missing = result.diagnostics.filter(
			({ code }) => code === DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
		);
		expect(missing).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					referenceId: "item:missing-units",
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
										distance: "far",
										selector: {
											type: "item" as const,
											itemUid: "item:producer",
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
										distance: "far",
										selector: {
											type: "item" as const,
											itemUid: "item:missing-rule",
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
			[producer.uid]: producer,
		});

		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				path: [
					"items",
					producer.uid,
					"lines",
					0,
					"rules",
					1,
					"when",
					0,
					"query",
					"selector",
					"itemUid",
				],
				referenceId: "item:missing-rule",
			}),
		);
	});

	it("validates selectors in output set rules before their drops", async () => {
		const producer = createProducerItem({
			id: "item:producer",
			lines: [
				{
					...createLine({}),
					outcome: {
						set: [
							{
								weight: 1,
								rules: [
									{
										type: "enable",
										when: [
											{
												type: "exists",
												query: {
													distance: "far",
													selector: {
														type: "item",
														itemUid: "item:missing-set-rule",
													},
												},
											},
										],
									},
								],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "item",
												itemUid: "item:producer",
												quantity: {
													min: 1,
													max: 1,
												},
												placement: "drop",
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				},
			],
		});
		const result = await compileItems({
			[producer.uid]: producer,
		});

		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				path: [
					"items",
					producer.uid,
					"lines",
					0,
					"outcome",
					"set",
					0,
					"rules",
					0,
					"when",
					0,
					"query",
					"selector",
					"itemUid",
				],
				referenceId: "item:missing-set-rule",
			}),
		);
	});
});
