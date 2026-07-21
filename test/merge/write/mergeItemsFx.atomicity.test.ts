import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/engine/runtime/write/removeItemFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
	weightedMergeOutput,
} from "~test/merge/support/createMergeTestConfig";

const boardItem = (id: "source" | "target", itemId: "source" | "target", x: number) => ({
	id: `runtime:${id}`,
	itemId,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
	quantity: 1,
});

const mergeAttemptFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source");
		const target = before.items.find((item) => item.id === "runtime:target");
		if (source === undefined || target === undefined) {
			return yield* Effect.dieMessage("Expected merge participants.");
		}
		const attempt = yield* Effect.either(
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
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			boardItem("source", "source", 0),
			boardItem("target", "target", 1),
			...(includeBlocker
				? [
						{
							id: "runtime:blocker",
							itemId: "blocker",
							location: {
								scope: "inventory" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
							quantity: 1,
						},
					]
				: []),
		],
		jobs: [],
	}) satisfies StateSchema.Type;

describe("mergeItemsFx atomicity", () => {
	it("rolls back target replacement when a used source cannot return through maxCount", () => {
		const config = createMergeTestConfig({
			sourceMaxCount: 1,
			sourceMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "use",
				effect: "replace",
				result: "source",
			},
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", "source", 0),
				boardItem("target", "target", 1),
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "source",
				reason: "item:max-count",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("rolls back source consumption when optional output cannot fit completely", () => {
		const config = createMergeTestConfig({
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			outputMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: guaranteedMergeOutput({
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

		expect(Either.isLeft(result.attempt)).toBe(true);
		if (Either.isLeft(result.attempt)) {
			expect(result.attempt.left).toMatchObject({
				_tag: "PlacementUnavailableError",
				itemId: "output",
				remainingQuantity: 1,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("replays the same random output after a blocked attempt", () => {
		const config = createMergeTestConfig({
			board: {
				width: 2,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: weightedMergeOutput(),
			},
		});
		const afterRetry = Effect.runSync(
			Effect.gen(function* () {
				const blocked = yield* mergeAttemptFx();
				if (Either.isRight(blocked.attempt)) {
					return yield* Effect.dieMessage("Expected the first merge to be blocked.");
				}
				const blocker = blocked.after.items.find((item) => item.id === "runtime:blocker");
				if (blocker === undefined) return yield* Effect.dieMessage("Expected blocker.");
				yield* removeItemFx({
					itemId: blocker.id,
					revision: blocker.revision,
				});
				const retry = yield* mergeAttemptFx();
				if (Either.isLeft(retry.attempt)) return yield* Effect.fail(retry.attempt.left);
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
				if (Either.isLeft(result.attempt)) return yield* Effect.fail(result.attempt.left);
				return result.after;
			}).pipe(
				useGameFx({
					config,
					state: blockedOutputState(false),
				}),
			),
		);

		const outputId = (runtime: typeof afterRetry) =>
			runtime.items.find((item) => item.item.id === "output:a" || item.item.id === "output:b")
				?.item.id;
		expect(outputId(afterRetry)).toBeDefined();
		expect(outputId(afterRetry)).toBe(outputId(firstTry));
	});

	it("lets removed source quantity satisfy maxCount for same-item optional output", () => {
		const config = createMergeTestConfig({
			sourceMaxCount: 1,
			sourceMaxStackSize: 1,
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
				output: guaranteedMergeOutput({
					itemId: "source",
				}),
			},
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", "source", 0),
				boardItem("target", "target", 1),
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			mergeAttemptFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Either.isRight(result.attempt)).toBe(true);
		expect(
			result.after.items
				.filter((item) => item.item.id === "source")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(1);
	});
});
