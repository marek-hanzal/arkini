import { Effect } from "effect";

import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { removeRuntimeItemForTestFx } from "~test/support/item-interaction/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/fx/support/lineTestRuntime";

export const createFixedStepTestConfig = () => {
	const base = createJobTestConfig();
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				uid: "permit",
				id: "permit",
				title: "Permit",
				description: "Enables the dependent producer.",
			},
			enabler: {
				...forge,
				uid: "enabler",
				id: "enabler",
				title: "Enabler",
				description: "Produces the permit at the end of one step.",
				lines: [
					{
						id: "line:enabler:run",
						title: "Enable",
						description: "Produce one permit.",
						runtimeMs: 200,
						input: [
							{
								type: "simple",
							},
						],
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "permit",
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
						rules: [],
					},
				],
			},
			dependent: {
				...forge,
				uid: "dependent",
				id: "dependent",
				title: "Dependent",
				description: "Runs only while the permit exists.",
				lines: [
					{
						id: "line:dependent:run",
						title: "Depend",
						description: "Wait for the permit.",
						runtimeMs: 400,
						input: [
							{
								type: "simple",
							},
						],
						rules: [
							{
								type: "enable",
								when: [
									existsWhen("permit"),
								],
							},
						],
					},
				],
			},
		},
	});
};

export const prepareFixedStepRuntimeFx = Effect.fn("prepareFixedStepRuntimeFx")(function* () {
	const enabler = yield* spawnItemFx({
		id: "runtime:enabler",
		itemId: "enabler",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
		quantity: 1,
	});
	const dependent = yield* spawnItemFx({
		id: "runtime:dependent",
		itemId: "dependent",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
		quantity: 1,
	});
	const permit = yield* spawnItemFx({
		id: "runtime:permit:initial",
		itemId: "permit",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		},
		quantity: 1,
	});
	yield* startLineFx({
		ownerItemId: dependent.id,
		lineId: "line:dependent:run",
	});
	yield* startLineFx({
		ownerItemId: enabler.id,
		lineId: "line:enabler:run",
	});
	yield* removeRuntimeItemForTestFx({
		itemId: permit.id,
		revision: permit.revision,
	});
	return yield* readRuntimeFx();
});

export const summarizeFixedStepRuntimeFn = (runtime: RuntimeSchema.Type) => ({
	dependentRemainingMs: runtime.jobs.find((job) => job.ownerItemId === "runtime:dependent")
		?.remainingMs,
	enablerActive: runtime.jobs.some((job) => job.ownerItemId === "runtime:enabler"),
	permitQuantity: runtime.items
		.filter((item) => item.item.id === "permit")
		.reduce((quantity, item) => quantity + item.quantity, 0),
});
