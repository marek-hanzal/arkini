import { Cause, Deferred, Effect, Exit, Fiber, Option, Result } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { createGameSessionFx } from "~/renderer/game/session/createGameSessionFx";
import { GameSessionNotRunningError } from "~/renderer/game/session/GameSessionNotRunningError";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";

describe("GameSession.runFx", () => {
	it.effect("returns success and provides the existing session services", () =>
		Effect.gen(function* () {
			const config = createJobTestConfig();
			const session = yield* createGameSessionFx({
				config,
				tickIntervalMs: 60_000,
			});
			yield* Effect.addFinalizer(() => session.disposeFx.pipe(Effect.orDie));

			const result = yield* session.runFx(
				Effect.gen(function* () {
					return {
						config: yield* GameConfigFx,
						value: "success",
					} as const;
				}),
			);

			expect(result.value).toBe("success");
			expect(result.config).toBe(config);
		}),
	);

	it.effect("preserves a command's exact typed failure", () =>
		Effect.gen(function* () {
			const session = yield* createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
			});
			yield* Effect.addFinalizer(() => session.disposeFx.pipe(Effect.orDie));
			const failure = {
				_tag: "TestCommandError",
			} as const;

			const exit = yield* Effect.exit(session.runFx(Effect.fail(failure)));

			expect(exit).toEqual(Exit.fail(failure));
		}),
	);

	it.effect("preserves a command defect in the Cause", () =>
		Effect.gen(function* () {
			const session = yield* createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
			});
			yield* Effect.addFinalizer(() => session.disposeFx.pipe(Effect.orDie));
			const defect = new Error("command defect");

			const exit = yield* Effect.exit(session.runFx(Effect.die(defect)));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const found = Cause.findDefect(exit.cause);
				expect(Result.isSuccess(found)).toBe(true);
				if (Result.isSuccess(found)) {
					expect(found.success).toBe(defect);
				}
			}
		}),
	);

	it.effect("interrupts the underlying command when its caller is interrupted", () =>
		Effect.gen(function* () {
			const session = yield* createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
			});
			yield* Effect.addFinalizer(() => session.disposeFx.pipe(Effect.orDie));

			const entered = yield* Deferred.make<void>();
			const interrupted = yield* Deferred.make<void>();
			const caller = yield* session
				.runFx(
					Deferred.succeed(entered, undefined).pipe(
						Effect.andThen(Effect.never),
						Effect.onInterrupt(() =>
							Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
						),
					),
				)
				.pipe(Effect.forkChild);

			yield* Deferred.await(entered);
			yield* Fiber.interrupt(caller);
			yield* Deferred.await(interrupted);
			const exit = yield* Fiber.await(caller);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			}
		}),
	);

	it.effect("interrupts every running command when the session is disposed", () =>
		Effect.gen(function* () {
			const session = yield* createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
			});
			const entered = yield* Deferred.make<void>();
			const interrupted = yield* Deferred.make<void>();
			const caller = yield* session
				.runFx(
					Deferred.succeed(entered, undefined).pipe(
						Effect.andThen(Effect.never),
						Effect.onInterrupt(() =>
							Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
						),
					),
				)
				.pipe(Effect.forkChild);

			yield* Deferred.await(entered);
			yield* session.disposeFx;
			yield* Deferred.await(interrupted);
			const exit = yield* Fiber.await(caller);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			}
		}),
	);

	it.effect("rejects commands while disposing and after disposal", () =>
		Effect.gen(function* () {
			const saveEntered = yield* Deferred.make<void>();
			const releaseSave = yield* Deferred.make<void>();
			const session = yield* createGameSessionFx({
				config: createJobTestConfig(),
				tickIntervalMs: 60_000,
				save: {
					debounceMs: 60_000,
					write: () =>
						Deferred.succeed(saveEntered, undefined).pipe(
							Effect.andThen(Deferred.await(releaseSave)),
						),
				},
			});
			const disposing = yield* session.disposeFx.pipe(Effect.forkChild);

			yield* Effect.gen(function* () {
				yield* Deferred.await(saveEntered);
				const disposingExit = yield* Effect.exit(session.runFx(Effect.void));

				expect(Exit.isFailure(disposingExit)).toBe(true);
				if (Exit.isFailure(disposingExit)) {
					const failure = Cause.findErrorOption(disposingExit.cause);
					expect(Option.isSome(failure)).toBe(true);
					if (Option.isSome(failure)) {
						expect(failure.value).toBeInstanceOf(GameSessionNotRunningError);
						expect(failure.value.state).toBe("disposing");
					}
				}

				yield* Deferred.succeed(releaseSave, undefined);
				yield* Fiber.join(disposing);
				const disposedExit = yield* Effect.exit(session.runFx(Effect.void));

				expect(disposedExit).toEqual(
					Exit.fail(
						new GameSessionNotRunningError({
							message: "Game session is disposed.",
							state: "disposed",
						}),
					),
				);
			}).pipe(
				Effect.ensuring(
					Deferred.succeed(releaseSave, undefined).pipe(
						Effect.andThen(Fiber.join(disposing)),
						Effect.orDie,
					),
				),
			);
		}),
	);
});
