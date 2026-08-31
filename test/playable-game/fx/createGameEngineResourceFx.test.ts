import { Cause, Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { createJobTestConfig } from "~test/production-job/support/jobTestConfig";
import { createTestGameSession } from "~test/support/createTestGameSession";
import { GameSessionFatalError } from "~/game-session/error/GameSessionFatalError";
import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";

const createResourceHarness = async () => {
	const config = createJobTestConfig();
	const session = await createTestGameSession({
		config,
		tickIntervalMs: 60_000,
	});
	const game = {
		...session,
		config,
		getResourceUrlFn: () => "blob:test",
	} satisfies PlayableGame;

	return {
		resource: Effect.runSync(createGameEngineResourceFx(game)),
		session,
	};
};

describe("createGameEngineResourceFx", () => {
	it("keeps the first critical resource failure as its permanent publication guard", async () => {
		const { resource, session } = await createResourceHarness();
		const firstCause = new Error("final save failed");

		try {
			const first = resource.markCriticalFailureFn("game-leave", firstCause);
			const second = resource.markCriticalFailureFn("game-reset", new Error("later failure"));

			expect(second).toBe(first);
			expect(first.cause).toBe(firstCause);
			expect(() => resource.assertUsableFn()).toThrow(first);
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("marks an unexpected live read failure critical with the same fail-stop error", async () => {
		const { resource, session } = await createResourceHarness();
		const failure = new Error("line projection invariant failed");

		try {
			expect(() => resource.game.readOrThrowFn(Effect.fail(failure))).toThrow(
				CriticalGameLifecycleError,
			);
			let critical: unknown;
			try {
				resource.assertUsableFn();
			} catch (cause) {
				critical = cause;
			}
			expect(critical).toBeInstanceOf(CriticalGameLifecycleError);
			const criticalError = critical as CriticalGameLifecycleError;
			expect(criticalError.operation).toBe("game-read");
			expect(criticalError.cause).toBeInstanceOf(GameSessionFatalError);
			const sessionFatal = criticalError.cause as GameSessionFatalError;
			expect(sessionFatal.source).toBe("runtime");
			expect(sessionFatal.cause).toBe(failure);
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("preserves a mixed live read Cause inside the game-read fail-stop error", async () => {
		const { resource, session } = await createResourceHarness();
		const readFailure = new Error("read failure");
		const readDefect = new Error("read defect");
		const readCause = Cause.combine(Cause.fail(readFailure), Cause.die(readDefect));

		try {
			expect(() => resource.game.readOrThrowFn(Effect.failCause(readCause))).toThrow(
				CriticalGameLifecycleError,
			);
			let critical: unknown;
			try {
				resource.assertUsableFn();
			} catch (cause) {
				critical = cause;
			}
			expect(critical).toBeInstanceOf(CriticalGameLifecycleError);
			expect((critical as CriticalGameLifecycleError).operation).toBe("game-read");
			const sessionFatal = (critical as CriticalGameLifecycleError).cause;
			expect(sessionFatal).toBeInstanceOf(GameSessionFatalError);
			expect((sessionFatal as GameSessionFatalError).source).toBe("runtime");
			const preservedCause = (sessionFatal as GameSessionFatalError).cause;
			expect(preservedCause).toBe(readCause);
			expect(Cause.isCause(preservedCause)).toBe(true);
			if (Cause.isCause(preservedCause)) {
				expect(Cause.hasDies(preservedCause)).toBe(true);
				expect(Cause.findErrorOption(preservedCause)).toEqual(Option.some(readFailure));
			}
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("freezes the exact session before publishing a presentation failure", async () => {
		const { resource, session } = await createResourceHarness();
		let notifications = 0;
		let readWasFrozenDuringNotification = false;
		let runWasFrozenDuringNotification = false;
		resource.subscribeCriticalFailureFn(() => {
			notifications += 1;
			readWasFrozenDuringNotification = session.readFn(Effect.void)._tag === "Failure";
			runWasFrozenDuringNotification =
				Effect.runSyncExit(session.runFx(Effect.void))._tag === "Failure";
		});
		const failure = new Error("presentation exploded");

		try {
			resource.game.reportCriticalFailureFn("game-presentation", failure);
			const first = resource.getCriticalFailureFn();
			resource.game.reportCriticalFailureFn("game-runtime", new Error("later failure"));

			expect(first?.operation).toBe("game-presentation");
			expect(resource.getCriticalFailureFn()).toBe(first);
			expect(session.getFatalErrorFn()?.source).toBe("presentation");
			expect(session.getFatalErrorFn()?.cause).toBe(failure);
			expect(notifications).toBe(1);
			expect(readWasFrozenDuringNotification).toBe(true);
			expect(runWasFrozenDuringNotification).toBe(true);
			await expect(session.runFn(Effect.void)).rejects.toMatchObject({
				_tag: "GameSessionNotRunningError",
				state: "frozen",
			});
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});

	it("freezes the exact session before publishing a failed readOrThrow", async () => {
		const { resource, session } = await createResourceHarness();
		let readWasFrozenDuringNotification = false;
		let runWasFrozenDuringNotification = false;
		resource.subscribeCriticalFailureFn(() => {
			readWasFrozenDuringNotification = session.readFn(Effect.void)._tag === "Failure";
			runWasFrozenDuringNotification =
				Effect.runSyncExit(session.runFx(Effect.void))._tag === "Failure";
		});
		const failure = new Error("read exploded");
		let thrown: unknown;

		try {
			try {
				resource.game.readOrThrowFn(Effect.fail(failure));
			} catch (cause) {
				thrown = cause;
			}

			const first = resource.getCriticalFailureFn();
			const sessionFatal = session.getFatalErrorFn();
			expect(thrown).toBe(first);
			expect(first?.operation).toBe("game-read");
			expect(first?.cause).toBe(sessionFatal);
			expect(sessionFatal?.source).toBe("runtime");
			expect(sessionFatal?.cause).toBe(failure);
			expect(readWasFrozenDuringNotification).toBe(true);
			expect(runWasFrozenDuringNotification).toBe(true);
			await expect(Effect.runPromise(session.runFx(Effect.void))).rejects.toMatchObject({
				_tag: "GameSessionNotRunningError",
				state: "frozen",
			});
		} finally {
			await Effect.runPromise(session.disposeFx);
		}
	});
});
