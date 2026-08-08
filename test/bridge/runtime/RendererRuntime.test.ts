import { Effect } from "effect";
import { afterAll, describe, expect, it } from "vitest";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

afterAll(async () => {
	await RendererRuntime.dispose();
});

describe("RendererRuntime", () => {
	it("constructs synchronously before the lazy editor database is opened", () => {
		expect(RendererRuntime.runSync(Effect.succeed("ready"))).toBe("ready");
	});
});
