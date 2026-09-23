import { Effect } from "effect";

import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

export const blockedCompletionOwnerId = "runtime:blocked-forge";
export const freeCompletionOwnerId = "runtime:free-forge";

export const createBlockedCompletionTestConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	const line = forge.lines[0];
	if (line === undefined) throw new Error("Expected producer line fixture.");

	return GameConfigSchema.parse({
		...base,
		meta: {
			...base.meta,
		},
		items: {
			...base.items,
			blocker: {
				...base.items.tool,
				uid: "blocker",
				title: "Blocker",
				description: "Occupies board delivery capacity.",
			},
			ingot: {
				...base.items.tool,
				uid: "ingot",
				title: "Ingot",
				description: "Blocked forge outcome.",
			},
			blockedForge: {
				...forge,
				uid: "blockedForge",
				title: "Blocked forge",
				description: "Cannot deliver while capacity is full.",
				lines: [
					{
						...line,
						uid: "line:blocked-forge:run",
						outcome: {
							set: [
								{
									rules: [],
									roll: [
										{
											type: "guaranteed",
											outcome: [
												{
													type: "item" as const,
													itemUid: "ingot",
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
			},
			freeForge: {
				...forge,
				uid: "freeForge",
				title: "Free forge",
				description: "Completes without delivery placement.",
				lines: [
					{
						...line,
						uid: "line:free-forge:run",
						input: [
							{
								type: "simple",
							},
						],
						outcome: undefined,
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
			itemUid: "blockedForge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		const freeOwner = yield* spawnItemFx({
			id: freeCompletionOwnerId,
			itemUid: "freeForge",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
		});
		for (let index = 0; index < 3; index += 1) {
			const water = yield* spawnItemFx({
				id: `runtime:blocked-water:${index}`,
				itemUid: "water",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 2,
						y: 0,
					},
				},
			});
			yield* bufferInputMaterialForTestFx({
				ownerItemId: blockedOwner.id,
				lineUid: "line:blocked-forge:run",
				inputIndex: 0,
				sourceItemId: water.id,
				sourceItemRevision: water.revision,
			});
		}
		const tool = yield* spawnItemFx({
			id: "runtime:blocked-tool",
			itemUid: "tool",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 3,
					y: 0,
				},
			},
		});

		yield* bufferInputMaterialForTestFx({
			ownerItemId: blockedOwner.id,
			lineUid: "line:blocked-forge:run",
			inputIndex: 1,
			sourceItemId: tool.id,
			sourceItemRevision: tool.revision,
		});
		yield* startLineFx({
			ownerItemId: blockedOwner.id,
			lineUid: "line:blocked-forge:run",
		});
		yield* startLineFx({
			ownerItemId: freeOwner.id,
			lineUid: "line:free-forge:run",
		});

		let blockerIndex = 0;
		for (let y = 0; y < 2; y += 1) {
			for (let x = 0; x < 5; x += 1) {
				if (y === 0 && (x === 0 || x === 1)) continue;
				yield* spawnItemFx({
					id: `runtime:completion-blocker:${blockerIndex}`,
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
	},
);
