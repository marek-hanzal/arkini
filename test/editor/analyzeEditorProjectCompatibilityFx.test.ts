import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { analyzeEditorProjectCompatibilityFx } from "~/editor/version/analyzeEditorProjectCompatibilityFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const analyze = (next: typeof editorTestConfig) =>
	Effect.runSync(analyzeEditorProjectCompatibilityFx(editorTestConfig, next));

describe("analyzeEditorProjectCompatibilityFx", () => {
	it("keeps copy edits and added content save-compatible", () => {
		const result = analyze({
			...editorTestConfig,
			meta: {
				...editorTestConfig.meta,
				title: "Renamed game",
			},
			items: {
				...editorTestConfig.items,
				stone: {
					...editorTestConfig.items.water,
					uid: "stone",
					id: "stone",
					title: "Stone",
				},
			},
		});

		expect(result.level).toBe("minor");
	});

	it("marks removed persisted item identities as breaking with a concrete reason", () => {
		const result = analyze({
			...editorTestConfig,
			items: {},
		});

		expect(result).toMatchObject({
			level: "major",
			reasons: [
				{
					code: "item-removed",
					path: [
						"items",
						"water",
					],
				},
			],
		});
	});

	it("marks storage shrink as breaking because old locations may not fit", () => {
		const result = analyze({
			...editorTestConfig,
			meta: {
				...editorTestConfig.meta,
				board: {
					...editorTestConfig.meta.board,
					width: 1,
				},
			},
		});

		expect(result.level).toBe("major");
		expect(result.reasons[0]?.code).toBe("storage-shrunk");

		const removedToolbar = Effect.runSync(
			analyzeEditorProjectCompatibilityFx(
				{
					...editorTestConfig,
					meta: {
						...editorTestConfig.meta,
						toolbarSize: 1,
					},
				},
				editorTestConfig,
			),
		);
		expect(removedToolbar.level).toBe("major");
	});

	it("keeps append-only line inputs save-compatible", () => {
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer",
				}),
			],
		});
		const previous = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				producer,
			},
		});
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							input: [
								...producer.lines[0].input,
								{
									type: "simple",
								},
							],
						},
					],
				},
			},
		});

		const result = Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, next));

		expect(result.level).toBe("minor");
	});

	it("compares the effective persisted material capacity", () => {
		const materialInput = {
			type: "materials" as const,
			selector: {
				type: "item" as const,
				itemId: "water",
			},
			mode: "consume" as const,
			quantity: {
				min: 1,
				max: 3,
			},
			capacity: 2,
		};
		const producer = createProducerItem({
			id: "producer",
			input: [
				materialInput,
			],
		});
		const previous = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				producer,
			},
		});
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				...previous.items,
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							input: [
								{
									...materialInput,
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
						},
					],
				},
			},
		});

		const result = Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, next));

		expect(result.level).toBe("major");
		expect(result.reasons.map(({ code }) => code)).toContain("line-input-invalidated");

		const offsetCapacity = GameConfigSchema.parse({
			...next,
			items: {
				...next.items,
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							input: [
								{
									...materialInput,
									quantity: {
										min: 1,
										max: 4,
									},
									capacity: 1,
								},
							],
						},
					],
				},
			},
		});
		expect(
			Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, offsetCapacity)).level,
		).toBe("minor");

		const reducedDeliveryLimit = GameConfigSchema.parse({
			...next,
			items: {
				...next.items,
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							input: [
								{
									...materialInput,
									quantity: {
										min: 1,
										max: 1,
									},
									capacity: 4,
								},
							],
						},
					],
				},
			},
		});
		expect(
			Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, reducedDeliveryLimit))
				.level,
		).toBe("major");

		const closedActiveJobSlot = GameConfigSchema.parse({
			...next,
			items: {
				...next.items,
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							input: [
								{
									...materialInput,
									quantity: {
										min: 1,
										max: 5,
									},
									capacity: 0,
								},
							],
						},
					],
				},
			},
		});
		expect(
			Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, closedActiveJobSlot))
				.level,
		).toBe("major");
	});

	it("marks temporary-lifetime reductions as breaking", () => {
		const producer = createProducerItem({
			id: "producer",
			lines: [
				createLine({
					id: "line:producer",
				}),
			],
		});
		const temporary = {
			...createSimpleItem("temporary"),
			type: "temporary" as const,
			scope: "board" as const,
			maxStackSize: 1,
			durationMs: 2_000,
		};
		const previous = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				producer,
				temporary,
			},
		});
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				producer,
				temporary: {
					...temporary,
					durationMs: 1_000,
				},
			},
		});
		const result = Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, next));

		expect(result.level).toBe("major");
		expect(result.reasons.map(({ code }) => code)).toContain("temporary-duration-reduced");
	});

	it("marks outputs reserved by active jobs as breaking", () => {
		const output = createOutput([
			{
				itemId: "water",
			},
		]);
		const producer = createProducerItem({
			id: "producer",
		});
		const charged = {
			...createSimpleItem("charged"),
			charges: {
				amount: 1,
			},
		};
		const previous = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				producer,
				charged,
			},
		});
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				...previous.items,
				producer: {
					...producer,
					lines: [
						{
							...producer.lines[0],
							output,
						},
					],
				},
				charged: {
					...charged,
					charges: {
						...charged.charges,
						output,
					},
				},
			},
		});

		const result = Effect.runSync(analyzeEditorProjectCompatibilityFx(previous, next));

		expect(result.level).toBe("major");
		expect(result.reasons.map(({ code }) => code)).toEqual(
			expect.arrayContaining([
				"line-output-changed",
				"item-charge-output-changed",
			]),
		);
	});
});
