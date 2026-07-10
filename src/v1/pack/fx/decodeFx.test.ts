import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { decodeFx } from "./decodeFx";

describe("decodeFx", () => {
	it("treats malformed pack data as a defect", () => {
		const exit = Effect.runSyncExit(decodeFx(new Uint8Array()));

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.isDie(exit.cause)).toBe(true);
		}
	});
});
