import { Effect } from "effect";

import type { JobSchema } from "~/production-job/schema/JobSchema";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

const stableJobId = "job:completion-random-test";

export const createRandomCompletionConfig = () => {
	const base = createJobTestConfig(1);
	const forge = base.items.forge;
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
		},
		items: {
			...base.items,
			blocker: {
				...base.items.tool,
				uid: "blocker",
				title: "Blocker",
				description: "Fills completion capacity.",
			},
			outputA: {
				...base.items.tool,
				uid: "outputA",
				title: "Output A",
				description: "First deterministic completion alternative.",
			},
			outputB: {
				...base.items.tool,
				uid: "outputB",
				title: "Output B",
				description: "Second deterministic completion alternative.",
			},
			forge: {
				...forge,
				lines: [
					{
						...line,
						runtimeMs: 200,
						input: [],
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
													type: "item" as const,
													itemUid: "outputA",
													placement: "random",
													quantity: {
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
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "item" as const,
													itemUid: "outputB",
													placement: "random",
													quantity: {
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
			itemUid: "forge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		let blockerIndex = 0;
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 3; x += 1) {
				if (x === 0 && y === 0) continue;
				yield* spawnItemFx({
					id: `runtime:random-blocker:${blockerIndex}`,
					itemUid: "blocker",
					location: {
						scope: "board",
						space: 0,
						position: {
							x,
							y,
						},
					},
				});
				blockerIndex += 1;
			}
		}
		yield* startLineFx({
			ownerItemId: "runtime:random-forge",
			lineUid: "line:forge:run",
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
			items: fullRuntime.items.filter((item) => item.item.uid !== "blocker"),
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
		.filter((item) => item.item.uid === "outputA" || item.item.uid === "outputB")
		.map((item) => ({
			itemId: item.item.uid,
			location: item.location,
		}))
		.sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
