import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { directionalMergeConfig } from "./mergeGameplayFlow.test/directionalMergeConfig";

const mergeLiveItemsFx = (sourceItemId: string, targetItemId: string) =>
	Effect.gen(function* () {
		const runtime = yield* readRuntimeFx();
		const source = runtime.items.find((item) => item.id === sourceItemId);
		const target = runtime.items.find((item) => item.id === targetItemId);
		if (source === undefined || target === undefined) {
			return yield* Effect.die(new Error("Expected live merge participants."));
		}

		return (yield* mergeItemsFx({
			sourceItemId: source.id,
			sourceRevision: source.revision,
			targetItemId: target.id,
			targetRevision: target.revision,
		})).event;
	});

describe("directional merge gameplay", () => {
	it("isolates the stacked merge target and consumes one source in place", () => {
		const sourceLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "item:water",
					location: sourceLocation,
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:tree",
					itemId: "item:tree",
					location: targetLocation,
					quantity: 2,
				});

				const event = yield* mergeLiveItemsFx("runtime:water", "runtime:tree");
				return {
					event,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: directionalMergeConfig,
					state: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [],
						jobs: [],
						jobQueue: [],
					},
				}),
			),
		);

		expect(result.event).toEqual(
			expect.objectContaining({
				action: "consume",
				effect: "replace",
				resultCanonicalItemId: "item:double-tree",
			}),
		);
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			item: {
				id: "item:water",
			},
			location: sourceLocation,
			quantity: 1,
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:tree")).toMatchObject({
			item: {
				id: "item:double-tree",
			},
			location: targetLocation,
			quantity: 1,
		});

		const treeRemainder = result.runtime.items.find((item) => item.item.id === "item:tree");
		expect(treeRemainder).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
			quantity: 1,
		});
		expect(treeRemainder?.id).not.toBe("runtime:tree");
		expect(treeRemainder?.location).not.toEqual(targetLocation);
	});
});
