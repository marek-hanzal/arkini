import { Effect } from "effect";

import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

export const blockedCompletionOwnerId = "runtime:blocked-forge";
export const freeCompletionOwnerId = "runtime:free-forge";

export const createBlockedCompletionTestConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
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
				description: "Occupies board delivery capacity.",
				maxStackSize: 1,
				scope: "board",
			},
			ingot: {
				...base.items.tool,
				id: "ingot",
				title: "Ingot",
				description: "Blocked forge output.",
			},
			blockedForge: {
				...forge,
				id: "blockedForge",
				title: "Blocked forge",
				description: "Cannot deliver while capacity is full.",
				lines: [
					{
						...line,
						id: "line:blocked-forge:run",
						output: {
							set: [
								{
									roll: [
										{
											type: "guaranteed",
											drop: [
												{
													itemId: "ingot",
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
					},
				],
			},
			freeForge: {
				...forge,
				id: "freeForge",
				title: "Free forge",
				description: "Completes without delivery placement.",
				lines: [
					{
						...line,
						id: "line:free-forge:run",
						input: [
							{
								type: "simple",
							},
						],
						output: undefined,
					},
				],
			},
		},
	});
};

export const prepareBlockedCompletionRuntimeFx = Effect.fn("prepareBlockedCompletionRuntimeFx")(
	function* () {
		const blockedOwner = yield* spawnItemFx({
			id: blockedCompletionOwnerId,
			itemId: "blockedForge",
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
		const freeOwner = yield* spawnItemFx({
			id: freeCompletionOwnerId,
			itemId: "freeForge",
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
		const water = yield* spawnItemFx({
			id: "runtime:blocked-water",
			itemId: "water",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
			quantity: 3,
		});
		const tool = yield* spawnItemFx({
			id: "runtime:blocked-tool",
			itemId: "tool",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 3,
					y: 0,
				},
			},
			quantity: 1,
		});

		yield* storeInputMaterialFx({
			ownerItemId: blockedOwner.id,
			lineId: "line:blocked-forge:run",
			inputIndex: 0,
			sourceItemId: water.id,
			sourceItemRevision: water.revision,
			quantity: 3,
		});
		yield* storeInputMaterialFx({
			ownerItemId: blockedOwner.id,
			lineId: "line:blocked-forge:run",
			inputIndex: 1,
			sourceItemId: tool.id,
			sourceItemRevision: tool.revision,
			quantity: 1,
		});
		yield* startLineFx({
			ownerItemId: blockedOwner.id,
			lineId: "line:blocked-forge:run",
		});
		yield* startLineFx({
			ownerItemId: freeOwner.id,
			lineId: "line:free-forge:run",
		});

		let blockerIndex = 0;
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 5; x += 1) {
				if (y === 0 && (x === 0 || x === 1)) continue;
				yield* spawnItemFx({
					id: `runtime:completion-blocker:${blockerIndex}`,
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
	},
);
