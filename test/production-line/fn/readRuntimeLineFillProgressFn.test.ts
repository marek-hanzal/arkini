import { describe, expect, it } from "vitest";

import { readRuntimeLineFillProgressFn } from "~/production-line/fn/readRuntimeLineFillProgressFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const materialItem = {
	uid: "material",
	id: "material",
	type: "simple",
	title: "Material",
	description: "Material",
	asset: {
		default: [
			"asset:material",
		],
	},
	scope: "any",
	maxStackSize: 10,
} satisfies ItemSchema.Type;

const materialInput = (required: number, capacity = 0) =>
	({
		type: "materials",
		selector: {
			type: "item",
			itemId: materialItem.id,
		},
		mode: "consume",
		quantity: {
			min: required,
			max: required,
		},
		capacity,
	}) as const;

const line = {
	id: "line:fill",
	title: "Fill",
	description: "Normalized input fill.",
	default: false,
	show: true,
	enable: true,
	runtimeMs: 1_000,
	input: [
		materialInput(6, 3),
		materialInput(4),
	],
	rules: [],
} satisfies LineSchema.Type;

const runtime = ({
	active = false,
	storedQuantities,
}: {
	readonly active?: boolean;
	readonly storedQuantities: readonly [
		number,
		number,
	];
}) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: storedQuantities.flatMap((quantity, inputIndex) =>
			quantity === 0
				? []
				: [
						{
							id: `runtime:material:${inputIndex}`,
							revision: `revision:material:${inputIndex}:${quantity}`,
							item: materialItem,
							location: {
								scope: "input" as const,
								ownerItemId: "runtime:owner",
								lineId: line.id,
								inputIndex,
							},
							quantity,
						},
					],
		),
		jobs: active
			? [
					{
						id: "job:active",
						ownerItemId: "runtime:owner",
						lineId: line.id,
						durationMs: 1_000,
						remainingMs: 500,
					},
				]
			: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
	}) satisfies RuntimeSchema.Type;

const readFill = (nextRuntime: RuntimeSchema.Type, nextLine: LineSchema.Type = line) =>
	readRuntimeLineFillProgressFn({
		line: nextLine,
		ownerItemId: "runtime:owner",
		runtime: nextRuntime,
	});

describe("readRuntimeLineFillProgressFn", () => {
	it("clamps buffered capacity to the authored required quantity", () => {
		expect(
			readFill(
				runtime({
					storedQuantities: [
						9,
						0,
					],
				}),
				{
					...line,
					input: [
						line.input[0],
					],
				},
			),
		).toBe(1);
	});

	it("keeps consumed inputs visually complete while the line owns an active job", () => {
		expect(
			readFill(
				runtime({
					active: true,
					storedQuantities: [
						0,
						0,
					],
				}),
			),
		).toBe(1);
	});

	it("aggregates normalized fill across every material input", () => {
		expect(
			readFill(
				runtime({
					storedQuantities: [
						3,
						1,
					],
				}),
			),
		).toBe(0.4);
	});
});
