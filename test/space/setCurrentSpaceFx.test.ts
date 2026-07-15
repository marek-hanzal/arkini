import { Effect, Either, Fiber, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { readCurrentSpaceBoardItemsFx } from "~/v1/space/read/readCurrentSpaceBoardItemsFx";
import { setCurrentSpaceFx } from "~/v1/space/write/setCurrentSpaceFx";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { StateSchema } from "~/v1/state/schema/StateSchema";
import { boardLocation, multiSpaceTestConfig } from "~test/space/support/multiSpaceTestConfig";

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
				const invalid = yield* Effect.either(
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
		expect(Either.isLeft(result.invalid)).toBe(true);
		if (Either.isLeft(result.invalid)) {
			expect(result.invalid.left).toMatchObject({
				_tag: "SpaceInvalidError",
				space: -1,
			});
		}
		expect(result.after).toEqual(result.initial);
	});

	it("commits one navigation event and treats the current space as an idempotent no-op", async () => {
		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const transitions = yield* CommittedTransitionsFx;
					const changedSubscription = yield* transitions.subscribe;
					const changedFiber = yield* changedSubscription.changes.pipe(
						Stream.runHead,
						Effect.fork,
					);
					const changed = yield* setCurrentSpaceFx({
						space: 3,
					});
					const transition = Option.getOrThrow(yield* Fiber.join(changedFiber));

					const noOpSubscription = yield* transitions.subscribe;
					const noOpFiber = yield* noOpSubscription.changes.pipe(
						Stream.runHead,
						Effect.fork,
					);
					const beforeNoOp = yield* readRuntimeFx();
					const noOp = yield* setCurrentSpaceFx({
						space: 3,
					});
					const afterNoOp = yield* readRuntimeFx();
					const published = yield* Fiber.poll(noOpFiber);
					yield* Fiber.interrupt(noOpFiber);

					return {
						afterNoOp,
						beforeNoOp,
						changed,
						noOp,
						published,
						transition,
					};
				}),
			).pipe(
				useGameFx({
					config: multiSpaceTestConfig,
				}),
			),
		);

		expect(result.changed).toBe(3);
		expect(result.transition.events).toEqual([
			{
				type: "current-space:changed",
				previousSpace: 0,
				currentSpace: 3,
			},
		]);
		expect(result.noOp).toBe(3);
		expect(result.afterNoOp).toBe(result.beforeNoOp);
		expect(Option.isNone(result.published)).toBe(true);
	});

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
				session: {
					speedMode: "normal",
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
