import { Deferred, Effect, Fiber, Option, Result, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readCurrentSpaceBoardItemsFx } from "~/engine/space/read/readCurrentSpaceBoardItemsFx";
import { setCurrentSpaceFx } from "~/engine/space/write/setCurrentSpaceFx";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { StateSchema } from "~/engine/state/schema/StateSchema";
import { boardLocation, multiSpaceTestConfig } from "~test/space/support/multiSpaceTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

const startInSpaceTwoConfig = GameConfigSchema.parse({
	...multiSpaceTestConfig,
	start: {
		...multiSpaceTestConfig.start,
		currentSpace: 2,
	},
});

describe("current board space", () => {
	it("starts from the explicit configured space and rejects invalid root commands", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const initial = yield* readRuntimeFx();
				const invalid = yield* Effect.result(
					setCurrentSpaceFx({
						space: -1,
					}),
				);
				return {
					initial,
					invalid,
					after: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: startInSpaceTwoConfig,
				}),
			),
		);

		expect(result.initial.currentSpace).toBe(2);
		expect(Result.isFailure(result.invalid)).toBe(true);
		if (Result.isFailure(result.invalid)) {
			expect(result.invalid.failure).toMatchObject({
				_tag: "SpaceInvalidError",
				space: -1,
			});
		}
		expect(result.after).toEqual(result.initial);
	});

	it.effect(
		"commits one navigation event and treats the current space as an idempotent no-op",
		() =>
			Effect.gen(function* () {
				const transitions = yield* CommittedTransitionsFx;
				const changedReplaySeen = yield* Deferred.make<void>();
				const changedFiber = yield* transitions.changes.pipe(
					Stream.tap(() => Deferred.succeed(changedReplaySeen, undefined)),
					Stream.drop(1),
					Stream.runHead,
					Effect.forkChild,
				);
				yield* Deferred.await(changedReplaySeen);
				const changed = yield* setCurrentSpaceFx({
					space: 3,
				});
				const transition = Option.getOrThrow(yield* Fiber.join(changedFiber));

				const noOpReplaySeen = yield* Deferred.make<void>();
				const noOpFiber = yield* transitions.changes.pipe(
					Stream.tap(() => Deferred.succeed(noOpReplaySeen, undefined)),
					Stream.drop(1),
					Stream.runHead,
					Effect.forkChild,
				);
				yield* Deferred.await(noOpReplaySeen);
				const beforeNoOp = yield* readRuntimeFx();
				const noOp = yield* setCurrentSpaceFx({
					space: 3,
				});
				const afterNoOp = yield* readRuntimeFx();
				const published = Option.fromNullishOr(noOpFiber.pollUnsafe());
				yield* Fiber.interrupt(noOpFiber);

				expect(changed).toBe(3);
				expect(transition.events).toEqual([
					{
						type: GameEventEnumSchema.enum.CurrentSpaceChanged,
						previousSpace: 0,
						currentSpace: 3,
					},
				]);
				expect(noOp).toBe(3);
				expect(afterNoOp).toBe(beforeNoOp);
				expect(Option.isNone(published)).toBe(true);
			}).pipe(
				useGameFx({
					config: multiSpaceTestConfig,
				}),
			),
	);

	it("persists navigation and every explicit board space while reading only the current board", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:space:0",
					itemId: "log",
					location: boardLocation(0, 0),
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:space:1",
					itemId: "log",
					location: boardLocation(1, 0),
					quantity: 1,
				});
				yield* setCurrentSpaceFx({
					space: 1,
				});
				const visible = yield* readCurrentSpaceBoardItemsFx();
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});

				return {
					restored,
					state,
					visible,
				};
			}).pipe(
				useGameFx({
					config: multiSpaceTestConfig,
				}),
			),
		);

		expect(result.visible.map((item) => item.id)).toEqual([
			"runtime:space:1",
		]);
		expect(result.state.currentSpace).toBe(1);
		expect(result.restored.currentSpace).toBe(1);
		expect(result.state.items.map((item) => item.location)).toEqual([
			boardLocation(0, 0),
			boardLocation(1, 0),
		]);
		expect(result.restored.items.map((item) => item.location)).toEqual([
			boardLocation(0, 0),
			boardLocation(1, 0),
		]);
	});

	it("requires currentSpace in runtime and state roots", () => {
		expect(
			RuntimeSchema.safeParse({
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				items: [],
				jobs: [],
				jobQueue: [],
			}).success,
		).toBe(false);
		expect(
			StateSchema.safeParse({
				items: [],
				jobs: [],
				jobQueue: [],
			}).success,
		).toBe(false);
	});
});
