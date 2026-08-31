import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { ArkpackStorageError } from "~/arkpack-catalog/error/ArkpackStorageError";
import { createElectronArkpackStorageFx } from "~/arkpack-catalog/fx/createElectronArkpackStorageFx";

describe("createElectronArkpackStorageFx", () => {
	it("turns Electron filesystem rejection into one typed transport error", async () => {
		const cause = new Error("disk unavailable");
		const storage = Effect.runSync(
			createElectronArkpackStorageFx({
				api: {
					installFn: vi.fn(),
					listFn: vi.fn().mockRejectedValue(cause),
					openUserDirectoryFn: vi.fn(),
					readFn: vi.fn(),
					removeFn: vi.fn(),
				},
			}),
		);
		const exit = await Effect.runPromiseExit(storage.listFx);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit)) throw new Error("Expected storage failure.");
		const failure = Cause.findErrorOption(exit.cause);
		expect(Option.isSome(failure)).toBe(true);
		if (Option.isNone(failure)) throw new Error("Expected typed storage failure.");
		expect(failure.value).toEqual(
			new ArkpackStorageError({
				operation: "list",
				cause,
			}),
		);
	});
});
