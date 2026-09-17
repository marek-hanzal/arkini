import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
		itemId: "source",
		location: board(0),
		quantity: 1,
	});
	const target = yield* spawnItemFx({
		id: "target",
		itemId: "target",
		location: board(1),
		quantity: 1,
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
	] as const)("preserves source depletion stacked into the target before %s", (effect) => {
		const output = guaranteedMergeOutput();
		output.set[0].roll[0].drop[0].rules = [
			{
				type: "enable",
				when: [
					{
						type: "count",
						count: 1,
						query: {
							scope: "board",
							distance: "self",
							selector: {
								type: "item",
								itemId: "target",
							},
						},
					},
				],
			},
		];
		const config = createMergeTestConfig({
			sourceUnits: {
				amount: 1,
				output: guaranteedMergeOutput({
					itemId: "target",
				}),
			},
			rule: {
				target: {
					type: "item",
					itemId: "target",
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
				output,
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
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "target")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(1);
		// Optional output still queries the pre-merge target, even though settlement changed it.
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "output")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(1);
		expect(result.transition.events).not.toContainEqual(
			expect.objectContaining({
				type: "item:disappeared",
				itemId: "target",
			}),
		);
	});

	it.each([
		"live",
		"reserved",
	] as const)(
		"rejects replacement at the %s maxCount without changing runtime or events",
		(capacity) => {
			const base = createMergeTestConfig({
				resultMaxCount: 1,
				rule: {
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "replace",
					result: "result",
				},
			});
			const config = GameConfigSchema.parse({
				...base,
				items: {
					...base.items,
					blocker: {
						...base.items.blocker,
						lines: [
							{
								id: "produce",
								title: "Produce",
								description: "Produce result",
								runtimeMs: 1000,
								input: [
									{
										type: "simple",
									},
								],
								output: guaranteedMergeOutput({
									itemId: "result",
								}),
								rules: [],
							},
						],
					},
				},
			});
			const result = Effect.runSync(
				Effect.gen(function* () {
					const { source, target } = yield* spawnParticipantsFx;
					const capacityOwner = yield* spawnItemFx({
						id: "capacity",
						itemId: capacity === "live" ? "result" : "blocker",
						location: board(2),
						quantity: 1,
					});
					if (capacity === "reserved")
						yield* startLineFx({
							ownerItemId: capacityOwner.id,
							lineId: "produce",
						});
					const transitions = yield* CommittedTransitionsFx;
					const before = yield* transitions.read;
					const drop = yield* dropItemFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: board(0),
						target: {
							kind: "slot",
							location: board(1),
							occupant: {
								itemId: target.id,
								revision: target.revision,
							},
						},
					});
					return {
						before,
						after: yield* transitions.read,
						drop,
					};
				}).pipe(
					useGameFx({
						config,
					}),
				),
			);
			expect(result.drop).toMatchObject({
				kind: "reject",
				reason: "blocked",
			});
			expect(result.after).toBe(result.before);
		},
	);

	it.each([
		"source",
		"target",
	] as const)(
		"credits the removed %s quantity when admitting a same-item replacement",
		(resultItemId) => {
			const base = createMergeTestConfig({
				sourceMaxCount: 1,
				rule: {
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "replace",
					result: resultItemId,
				},
			});
			const config = GameConfigSchema.parse({
				...base,
				items: {
					...base.items,
					target: {
						...base.items.target,
						maxCount: 1,
					},
				},
			});
			const runtime = Effect.runSync(
				Effect.gen(function* () {
					const { source, target } = yield* spawnParticipantsFx;
					yield* mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					});
					return yield* readRuntimeFx();
				}).pipe(
					useGameFx({
						config,
					}),
				),
			);
			expect(runtime.items).toHaveLength(1);
			expect(runtime.items[0]).toMatchObject({
				id: "target",
				quantity: 1,
				item: {
					id: resultItemId,
				},
			});
		},
	);
});
