import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
	weightedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";

const boardItem = (id: "source" | "target", itemId: "source" | "target", x: number) => ({
	id: `runtime:${id}`,
	itemUid: itemId,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
});

const mergeAttemptFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source");
		const target = before.items.find((item) => item.id === "runtime:target");
		if (source === undefined || target === undefined) {
			return yield* Effect.die(new Error("Expected merge participants."));
		}
		const attempt = yield* Effect.result(
			mergeItemsFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				targetItemId: target.id,
				targetRevision: target.revision,
			}),
		);
		return {
			after: yield* readRuntimeFx(),
			attempt,
			before,
		};
	});

const blockedOutputState = (includeBlocker = true) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			boardItem("source", "source", 0),
			boardItem("target", "target", 1),
			...(includeBlocker
				? [
						{
							id: "runtime:blocker",
							itemUid: "blocker",
							location: {
								scope: "board" as const,
								space: 0,
								position: {
									x: 2,
									y: 0,
								},
							},
						},
					]
				: []),
		],
		jobQueue: [],
		jobs: [],
	}) satisfies StateSchema.Type;

describe("mergeItemsFx atomicity", () => {
	it("rolls back when source depletion resets the target before its merge effect", () => {
		const baseConfig = createMergeTestConfig({
			sourceUnits: {
				amount: 1,
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
											type: "template",
											templateUid: "empty",
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			},
			rule: {
				target: {
					type: "item",
					itemUid: "target",
				},
				action: "spend",
				effect: "replace",
				result: "result",
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const attempt = yield* mergeAttemptFx();
				return {
					...attempt,
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: {
						...baseConfig,
						templates: [
							{
								uid: "empty",
								title: "Empty",
								width: 4,
								height: 2,
								board: [],
							},
						],
					},
					state: blockedOutputState(false),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "ItemNotFoundError",
				itemId: "runtime:target",
			});
		}
		expect(result.after).toEqual(result.before);
		expect(result.transition.events).not.toContainEqual(
			expect.objectContaining({
				type: "item:merged",
			}),
		);
	});

	it("rolls back source consumption when optional output cannot fit completely", () => {
		const config = createMergeTestConfig({
			board: {
				width: 3,
				height: 1,
			},
			rule: {
				target: {
					type: "item",
					itemUid: "target",
				},
				action: "consume",
				effect: "keep",
				outcome: guaranteedMergeOutput({
					quantity: 2,
				}),
			},
		});
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state: blockedOutputState(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemUid: "output",
				remainingQuantity: 1,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("replays the same random output after a blocked attempt", () => {
		const config = createMergeTestConfig({
			board: {
				width: 3,
				height: 1,
			},
			rule: {
				target: {
					type: "item",
					itemUid: "target",
				},
				action: "consume",
				effect: "keep",
				outcome: weightedMergeOutput(),
			},
		});
		const afterRetry = Effect.runSync(
			Effect.gen(function* () {
				const blocked = yield* mergeAttemptFx();
				if (Result.isSuccess(blocked.attempt)) {
					return yield* Effect.die(new Error("Expected the first merge to be blocked."));
				}
				const blocker = blocked.after.items.find((item) => item.id === "runtime:blocker");
				if (blocker === undefined) {
					return yield* Effect.die(new Error("Expected blocker."));
				}
				yield* removeRuntimeItemForTestFx({
					itemId: blocker.id,
					revision: blocker.revision,
				});
				const retry = yield* mergeAttemptFx();
				if (Result.isFailure(retry.attempt))
					return yield* Effect.fail(retry.attempt.failure);
				return retry.after;
			}).pipe(
				useGameFx({
					config,
					state: blockedOutputState(),
				}),
			),
		);
		const firstTry = Effect.runSync(
			Effect.gen(function* () {
				const result = yield* mergeAttemptFx();
				if (Result.isFailure(result.attempt))
					return yield* Effect.fail(result.attempt.failure);
				return result.after;
			}).pipe(
				useGameFx({
					config,
					state: blockedOutputState(false),
				}),
			),
		);

		const outputId = (runtime: typeof afterRetry) =>
			runtime.items.find(
				(item) => item.item.uid === "output:a" || item.item.uid === "output:b",
			)?.item.uid;
		expect(outputId(afterRetry)).toBeDefined();
		expect(outputId(afterRetry)).toBe(outputId(firstTry));
	});
});
