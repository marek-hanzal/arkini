import { describe, expect, it } from "vitest";
import { Cause, Effect, Option } from "effect";
import { CriticalGameLifecycleError } from "~/renderer/game/resource/CriticalGameLifecycleError";
import { GameSessionFatalError } from "~/renderer/game/session/GameSessionFatalError";

import { makeResource } from "./GameEngineResourceFx.test/fixture";

describe("GameEngineResourceFx / critical reads", () => {
	it("keeps the first critical resource failure as its permanent publication guard", () => {
		const resource = makeResource({
			packageId: "package:guard",
		});
		const firstCause = new Error("final save failed");
		const first = resource.markCriticalFailure("game-leave", firstCause);
		const second = resource.markCriticalFailure("game-reset", new Error("later failure"));

		expect(second).toBe(first);
		expect(first.cause).toBe(firstCause);
		expect(() => resource.assertUsable()).toThrow(first);
	});
	it("marks an unexpected live read failure critical with the same fail-stop error", () => {
		const resource = makeResource({
			packageId: "package:read",
		});
		const failure = new Error("line projection invariant failed");

		expect(() => resource.game.readOrThrow(Effect.fail(failure))).toThrow(
			CriticalGameLifecycleError,
		);
		let critical: unknown;
		try {
			resource.assertUsable();
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
	});
	it("preserves a mixed live read Cause inside the game-read fail-stop error", () => {
		const resource = makeResource({
			packageId: "package:mixed-read",
		});
		const readFailure = new Error("read failure");
		const readDefect = new Error("read defect");
		const readCause = Cause.combine(Cause.fail(readFailure), Cause.die(readDefect));

		expect(() => resource.game.readOrThrow(Effect.failCause(readCause))).toThrow(
			CriticalGameLifecycleError,
		);
		let critical: unknown;
		try {
			resource.assertUsable();
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
	});
});
