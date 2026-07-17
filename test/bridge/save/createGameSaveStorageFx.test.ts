import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createGameSaveStorageFx } from "~/bridge/save/createGameSaveStorageFx";
import { GameSaveStorageError } from "~/bridge/save/GameSaveStorageError";

describe("createGameSaveStorageFx", () => {
	it("turns Electron filesystem rejection into one typed bridge error", async () => {
		const cause = new Error("disk full");
		const storage = Effect.runSync(
			createGameSaveStorageFx({
				api: {
					clear: vi.fn(),
					read: vi.fn(),
					write: vi.fn().mockRejectedValue(cause),
				},
			}),
		);
		const exit = await Effect.runPromiseExit(
			storage.writeFx(
				{
					packageId: "arkini",
					contentHash: "a".repeat(64),
				},
				new Uint8Array([
					1,
				]),
			),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected storage failure.");
		const failure = Cause.failureOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed storage failure.");
		expect(failure.value).toEqual(
			new GameSaveStorageError({
				operation: "write",
				cause,
			}),
		);
	});
});
