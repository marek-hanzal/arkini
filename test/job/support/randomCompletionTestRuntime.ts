import { Effect } from "effect";

import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

const stableJobId = "job:completion-random-test";

export const createRandomCompletionConfig = () => {
	const base = createJobTestConfig(1);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
			board: {
				width: 3,
				height: 2,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		items: {
			...base.items,
			blocker: {
				...base.items.tool,
				id: "blocker",
				title: "Blocker",
				description: "Fills completion capacity.",
				maxStackSize: 1,
			},
			outputA: {
				...base.items.tool,
				id: "outputA",
				title: "Output A",
				description: "First deterministic completion alternative.",
			},
			outputB: {
				...base.items.tool,
				id: "outputB",
				title: "Output B",
				description: "Second deterministic completion alternative.",
			},
			forge: {
				...forge,
				lines: [
					{
						...line,
						runtimeMs: 200,
						input: [
							{
								type: "simple",
							},
						],
						output: {
							set: [
								{
									weight: 1,
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "outputA",
													placement: "random",
													quantity: {
														type: "range",
														min: 1,
														max: 3,
													},
													rules: [],
												},
											],
										},
									],
								},
								{
									weight: 1,
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "outputB",
													placement: "random",
													quantity: {
														type: "range",
														min: 1,
														max: 3,
													},
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

export const prepareRandomCompletionRuntimeFx = Effect.fn("prepareRandomCompletionRuntimeFx")(
	function* () {
		yield* spawnItemFx({
			id: "runtime:random-forge",
			itemId: "forge",
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
		let blockerIndex = 0;
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 3; x += 1) {
				if (x === 0 && y === 0) continue;
				yield* spawnItemFx({
					id: `runtime:random-blocker:${blockerIndex}`,
					itemId: "blocker",
					location: {
						scope: "board",
						space: 0,
						position: {
							x,
							y,
						},
					},
					quantity: 1,
				});
				blockerIndex += 1;
			}
		}
		yield* spawnItemFx({
			id: "runtime:random-inventory-blocker",
			itemId: "blocker",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
		});
		yield* startLineFx({
			ownerItemId: "runtime:random-forge",
			lineId: "line:forge:run",
		});
		const runtime = yield* readRuntimeFx();
		const liveJob = runtime.jobs[0];
		if (liveJob === undefined) throw new Error("Expected active completion job.");
		const job = {
			...liveJob,
			id: stableJobId,
			remainingMs: 0,
		} satisfies JobSchema.Type;
		const fullRuntime = {
			...runtime,
			jobs: [
				job,
			],
		} satisfies RuntimeSchema.Type;
		const freeRuntime = {
			...fullRuntime,
			items: fullRuntime.items.filter((item) => item.item.id !== "blocker"),
		} satisfies RuntimeSchema.Type;

		return {
			freeRuntime,
			fullRuntime,
			job,
		};
	},
);

export const projectRandomCompletionItems = (runtime: RuntimeSchema.Type) =>
	runtime.items
		.filter((item) => item.item.id === "outputA" || item.item.id === "outputB")
		.map((item) => ({
			itemId: item.item.id,
			location: item.location,
			quantity: item.quantity,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
