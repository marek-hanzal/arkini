import { Cause, Deferred, Effect, Exit, Fiber, Option, Result } from "effect";
import { describe, expect, it } from "vitest";

import { GameSessionNotRunningError } from "~/bridge/game/GameSessionNotRunningError";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { createTestGameSession } from "~test/bridge/game/createTestGameSession";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

describe("GameSession.runFx", () => {
	it("returns success and provides the existing session services", async () => {
		const config = createJobTestConfig();
		const session = await createTestGameSession({
			config,
			tickIntervalMs: 60_000,
		});

		try {
			const result = await Effect.runPromise(
				session.runFx(
					Effect.gen(function* () {
						return {
							config: yield* GameConfigFx,
							value: "success",
						} as const;
					}),
				),
			);

			expect(result.value).toBe("success");
			expect(result.config).toBe(config);
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("preserves a command's exact typed failure", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const failure = {
			_tag: "TestCommandError",
		} as const;

		try {
			const exit = await Effect.runPromiseExit(session.runFx(Effect.fail(failure)));

			expect(exit).toEqual(Exit.fail(failure));
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("preserves a command defect in the Cause", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const defect = new Error("command defect");

		try {
			const exit = await Effect.runPromiseExit(session.runFx(Effect.die(defect)));

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const found = Cause.findDefect(exit.cause);
				expect(Result.isSuccess(found)).toBe(true);
				if (Result.isSuccess(found)) {
					expect(found.success).toBe(defect);
				}
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("interrupts the underlying command when its caller is interrupted", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});

		try {
			const exit = await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const entered = yield* Deferred.make<void>();
						const interrupted = yield* Deferred.make<void>();
						const caller = yield* session
							.runFx(
								Deferred.succeed(entered, undefined).pipe(
									Effect.andThen(Effect.never),
									Effect.onInterrupt(() =>
										Deferred.succeed(interrupted, undefined).pipe(
											Effect.asVoid,
										),
									),
								),
							)
							.pipe(Effect.forkChild);

						yield* Deferred.await(entered);
						yield* Fiber.interrupt(caller);
						yield* Deferred.await(interrupted);
						return yield* Fiber.await(caller);
					}),
				),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("interrupts every running command when the session is disposed", async () => {
		const session = await createTestGameSession({
			config: createJobTestConfig(),
			tickIntervalMs: 60_000,
		});
		const entered = Effect.runSync(Deferred.make<void>());
		const interrupted = Effect.runSync(Deferred.make<void>());
		const caller = Effect.runFork(
			session.runFx(
				Deferred.succeed(entered, undefined).pipe(
					Effect.andThen(Effect.never),
					Effect.onInterrupt(() =>
						Deferred.succeed(interrupted, undefined).pipe(Effect.asVoid),
					),
				),
			),
		);

		await Effect.runPromise(Deferred.await(entered));
		await Effect.runPromise(session.disposeFx);
		await Effect.runPromise(Deferred.await(interrupted));
		const exit = await Effect.runPromise(Fiber.await(caller));

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		}
	});

	it("rejects commands while disposing and after disposal", async () => {
		const saveEntered = Effect.runSync(Deferred.make<void>());
		const releaseSave = Effect.runSync(Deferred.make<void>());
		const session = await createTestGameSession({
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
		const disposing = Effect.runFork(session.disposeFx);

		try {
			await Effect.runPromise(Deferred.await(saveEntered));
			const disposingExit = await Effect.runPromiseExit(session.runFx(Effect.void));

			expect(Exit.isFailure(disposingExit)).toBe(true);
			if (Exit.isFailure(disposingExit)) {
				const failure = Cause.findErrorOption(disposingExit.cause);
				expect(Option.isSome(failure)).toBe(true);
				if (Option.isSome(failure)) {
					expect(failure.value).toBeInstanceOf(GameSessionNotRunningError);
					expect(failure.value.state).toBe("disposing");
				}
			}

			Effect.runSync(Deferred.succeed(releaseSave, undefined));
			await Effect.runPromise(Fiber.join(disposing));
			const disposedExit = await Effect.runPromiseExit(session.runFx(Effect.void));

			expect(disposedExit).toEqual(
				Exit.fail(
					new GameSessionNotRunningError({
						message: "Game session is disposed.",
						state: "disposed",
					}),
				),
			);
		} finally {
			Effect.runSync(Deferred.succeed(releaseSave, undefined));
			await Effect.runPromise(Fiber.join(disposing));
		}
	});
});
