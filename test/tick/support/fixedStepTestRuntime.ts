import { Effect } from "effect";

import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";
import { existsWhen } from "~test/line/fx/support/lineTestRuntime";

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
				id: "permit",
				title: "Permit",
				description: "Enables the dependent producer.",
			},
			enabler: {
				...forge,
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
														type: "value",
														value: 1,
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
	yield* removeItemFx({
		itemId: permit.id,
		revision: permit.revision,
	});
	return yield* readRuntimeFx();
});

export const summarizeFixedStepRuntime = (runtime: RuntimeSchema.Type) => ({
	dependentRemainingMs: runtime.jobs.find((job) => job.ownerItemId === "runtime:dependent")
		?.remainingMs,
	enablerActive: runtime.jobs.some((job) => job.ownerItemId === "runtime:enabler"),
	permitQuantity: runtime.items
		.filter((item) => item.item.id === "permit")
		.reduce((quantity, item) => quantity + item.quantity, 0),
});
