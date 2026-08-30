import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createElectronGameSaveStorageFx } from "~/game-persistence/fx/createElectronGameSaveStorageFx";

describe("createElectronGameSaveStorageFx", () => {
	it("turns Electron filesystem rejection into one typed transport error", async () => {
		const cause = new Error("disk full");
		const storage = Effect.runSync(
			createElectronGameSaveStorageFx({
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
				},
				new Uint8Array([
					1,
				]),
			),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected storage failure.");
		const failure = Cause.findErrorOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed storage failure.");
		expect(failure.value).toMatchObject({
			_tag: "GameSaveStorageError",
			operation: "write",
			cause,
		});
	});
});
