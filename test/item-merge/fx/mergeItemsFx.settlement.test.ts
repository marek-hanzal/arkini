import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const spawnParticipantsFx = Effect.gen(function* () {
	const source = yield* spawnItemFx({
		id: "source",
		itemUid: "source",
		location: board(0),
	});
	const target = yield* spawnItemFx({
		id: "target",
		itemUid: "target",
		location: board(1),
	});
	return {
		source,
		target,
	};
});

describe("merge settlement against the evolving draft", () => {
	it.each([
		"remove",
		"replace",
	] as const)("preserves source depletion beside the target before %s", (effect) => {
		const output = guaranteedMergeOutput();
		output.set[0].roll[0].outcome[0].rules = [
			{
				type: "enable",
				when: [
					{
						type: "count",
						count: 1,
						query: {
							distance: "self",
							selector: {
								type: "item",
								itemUid: "source",
							},
						},
					},
				],
			},
		];
		const config = createMergeTestConfig({
			sourceUnits: {
				amount: 1,
				outcome: guaranteedMergeOutput({
					itemUid: "target",
				}),
			},
			rule: {
				target: {
					type: "item",
					itemUid: "target",
				},
				action: "spend",
				...(effect === "remove"
					? {
							effect,
						}
					: {
							effect,
							result: "result",
						}),
				outcome: output,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const { source, target } = yield* spawnParticipantsFx;
				yield* mergeItemsFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					targetItemId: target.id,
					targetRevision: target.revision,
				});
				return {
					runtime: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.items.filter((item) => item.item.uid === "target").length).toBe(1);
		// Outcome rules use the pre-merge source owner even after its depletion removes it.
		expect(result.runtime.items.filter((item) => item.item.uid === "output").length).toBe(1);
		expect(result.transition.events).not.toContainEqual(
			expect.objectContaining({
				type: "item:disappeared",
				itemId: "target",
			}),
		);
	});
});
