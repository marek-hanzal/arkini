import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	guaranteedMergeOutput,
	weightedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";

import {
	createConfigFn,
	initialState,
	mergeFx,
	repeatFx,
	saveFx,
	removeOutputsFx,
} from "./mergeItemsFx.random.test/fixture";

describe("merge random stream lifecycle", () => {
	it("advances successful reusable-stack rolls and resumes the same stream after save/load", () => {
		const config = createConfigFn();
		const live = Effect.runSync(
			Effect.gen(function* () {
				const first = yield* repeatFx(8);
				const saved = yield* saveFx();
				const second = yield* repeatFx(8);
				const runtime = yield* readRuntimeFx();
				return {
					first,
					saved,
					second,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
					state: initialState,
				}),
			),
		);
		// Fixed saved participant identities make this an exact reproducible stream,
		// not a statistical sample of ambient randomness.
		expect(new Set(live.first.flat()).size).toBe(2);
		expect(live.runtime.items.find((item) => item.id === "reusable-source")).toMatchObject({
			quantity: 2,
			mergeSequence: 16,
		});
		const restored = Effect.runSync(
			repeatFx(8).pipe(
				useGameFx({
					config,
					state: live.saved,
				}),
			),
		);
		expect(restored).toEqual(live.second);
	});

	it("preserves a nonzero cursor and the whole candidate across blocked retries and hydration", () => {
		const config = createConfigFn(true);
		const live = Effect.runSync(
			Effect.gen(function* () {
				yield* mergeFx();
				const before = yield* readRuntimeFx();
				for (let index = 0; index < 2; index++) {
					const rejected = yield* Effect.result(mergeFx());
					expect(Result.isFailure(rejected)).toBe(true);
					if (Result.isFailure(rejected))
						expect(rejected.failure).toMatchObject({
							_tag: "PlacementUnavailableError",
						});
					expect(yield* readRuntimeFx()).toBe(before);
				}
				const saved = yield* saveFx();
				yield* removeOutputsFx();
				const output = yield* mergeFx();
				return {
					saved,
					output,
				};
			}).pipe(
				useGameFx({
					config,
					state: initialState,
				}),
			),
		);
		expect(live.saved.items.find((item) => item.id === "reusable-source")?.mergeSequence).toBe(
			1,
		);
		const restored = Effect.runSync(
			Effect.gen(function* () {
				expect(Result.isFailure(yield* Effect.result(mergeFx()))).toBe(true);
				yield* removeOutputsFx();
				return yield* mergeFx();
			}).pipe(
				useGameFx({
					config,
					state: live.saved,
				}),
			),
		);
		expect(restored).toEqual(live.output);
	});

	it.each([
		"source",
		"target",
	] as const)(
		"advances nested %s depletion rolls when output restores the spent stack",
		(payer) => {
			const base = createConfigFn();
			const weighted = weightedMergeOutput();
			const output = {
				set: weighted.set.map((set) => ({
					...set,
					roll: [
						...guaranteedMergeOutput({
							itemId: payer,
						}).set[0].roll,
						...set.roll,
					],
				})),
			};
			const config = GameConfigSchema.parse({
				...base,
				items: {
					...base.items,
					source: {
						...base.items.source,
						units:
							payer === "source"
								? {
										amount: 1,
										output,
									}
								: undefined,
						merge: [
							{
								target: {
									type: "item",
									itemId: "target",
								},
								action: payer === "source" ? "spend" : "use",
								effect: payer === "target" ? "spend" : "keep",
							},
						],
					},
					target: {
						...base.items.target,
						units:
							payer === "target"
								? {
										amount: 1,
										output,
									}
								: undefined,
					},
				},
			});
			const state = StateSchema.parse({
				...initialState,
				items: initialState.items.map((item) => ({
					...item,
					quantity: 2,
				})),
			});
			const result = Effect.runSync(
				Effect.gen(function* () {
					const rolls = yield* repeatFx(16);
					return {
						rolls,
						runtime: yield* readRuntimeFx(),
					};
				}).pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);
			expect(new Set(result.rolls.flat()).size).toBe(2);
			expect(
				result.runtime.items.find((item) => item.id === "reusable-source"),
			).toMatchObject({
				quantity: 2,
				mergeSequence: 16,
			});
			expect(result.runtime.items.find((item) => item.id === "stable-target")?.quantity).toBe(
				2,
			);
		},
	);

	it("keeps an existing identity's stream when another merge replaces its definition", () => {
		const base = createConfigFn();
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				target: {
					...base.items.target,
					merge: [
						{
							target: {
								type: "item",
								itemId: "source",
							},
							action: "consume",
							effect: "replace",
							result: "result",
						},
					],
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* mergeFx();
				const runtime = yield* readRuntimeFx();
				const source = runtime.items.find((item) => item.id === "stable-target")!;
				const target = runtime.items.find((item) => item.id === "reusable-source")!;
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
					state: initialState,
				}),
			),
		);
		expect(result.items.find((item) => item.id === "reusable-source")).toMatchObject({
			quantity: 1,
			mergeSequence: 1,
		});
	});
});
