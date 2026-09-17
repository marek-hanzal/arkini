import { Effect } from "effect";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { spawnItemFx } from "~test/support/spawnItemFx";

const materialFn = (itemId: string, quantity: number, mode: "consume" | "reserve" = "consume") => ({
	type: "materials",
	selector: {
		type: "item",
		itemId,
	},
	mode,
	quantity: {
		min: quantity,
		max: quantity,
	},
});

export const configFn = ({
	mode = "consume",
	outputQuantity = 2,
}: {
	mode?: "consume" | "reserve";
	outputQuantity?: number;
} = {}) => {
	const workshop = inputRuntimeTestConfig.items.workshop;
	const line = workshop.lines[0];
	return GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		items: {
			...inputRuntimeTestConfig.items,
			water: {
				...inputRuntimeTestConfig.items.water,
				maxCount: 2,
			},
			vessel: {
				...workshop,
				uid: "vessel",
				id: "vessel",
				maxStackSize: 1,
				lines: [
					{
						...line,
						input: [
							materialFn("water", 2),
						],
					},
				],
			},
			workshop: {
				...workshop,
				maxStackSize: 1,
				lines: [
					{
						...line,
						input: [
							materialFn("vessel", 1),
						],
					},
				],
			},
			recycler: {
				...workshop,
				uid: "recycler",
				id: "recycler",
				maxStackSize: 1,
				lines: [
					{
						...line,
						id: "recycle",
						runtimeMs: 200,
						input: [
							materialFn("workshop", 1, mode),
						],
						output: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "water",
													quantity: {
														min: outputQuantity,
														max: outputQuantity,
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
			},
		},
	});
};

export const setupFx = Effect.gen(function* () {
	yield* spawnItemFx({
		id: "outer",
		itemId: "recycler",
		location: sourceLocation(0),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "inner",
		itemId: "workshop",
		location: sourceLocation(1),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "vessel",
		itemId: "vessel",
		location: sourceLocation(2),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "water",
		itemId: "water",
		location: sourceLocation(3),
		quantity: 2,
	});
	for (const [ownerItemId, sourceItemId, quantity, lineId] of [
		[
			"vessel",
			"water",
			2,
			"line:workshop:build",
		],
		[
			"inner",
			"vessel",
			1,
			"line:workshop:build",
		],
		[
			"outer",
			"inner",
			1,
			"recycle",
		],
	] as const) {
		const source = (yield* readRuntimeFx()).items.find((item) => item.id === sourceItemId)!;
		yield* storeInputMaterialFx({
			ownerItemId,
			lineId,
			inputIndex: 0,
			sourceItemId,
			sourceItemRevision: source.revision,
			quantity,
		});
	}
});

export const externalPayerConfigFn = () => {
	const base = configFn();
	const recycler = base.items.recycler;
	const line = recycler.lines[0]!;
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			payer: {
				...recycler,
				uid: "payer",
				id: "payer",
				units: {
					amount: 1,
					output: line.output,
				},
				lines: [
					{
						...line,
						id: "work",
						runtimeMs: 10000,
						input: [
							{
								type: "simple",
							},
						],
						output: undefined,
					},
				],
			},
			recycler: {
				...recycler,
				lines: [
					{
						...line,
						output: undefined,
						input: [
							...line.input,
							{
								type: "units",
								units: {
									from: "target",
									cost: 1,
								},
								query: {
									scope: "board",
									distance: "far",
									selector: {
										type: "item",
										itemId: "payer",
									},
								},
							},
						],
					},
				],
			},
		},
	});
};
