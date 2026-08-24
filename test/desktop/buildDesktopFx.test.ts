import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../cli/desktop/runBuiltArkiniCliFx", () => ({
	runBuiltArkiniCliFx: (args: ReadonlyArray<string>) =>
		Effect.sync(() => calls.push(`cli:${args.join(" ")}`)),
}));
vi.mock("../../cli/desktop/buildDesktopOutputFx", () => ({
	buildDesktopOutputFx: () => Effect.sync(() => calls.push("build-output")),
}));

import { buildDesktopFx } from "../../cli/desktop/buildDesktopFx";

describe("buildDesktopFx", () => {
	it("compiles Electron before invoking its production CLI", async () => {
		calls.length = 0;
		await Effect.runPromise(buildDesktopFx().pipe(Effect.provide(NodeServices.layer)));

		expect(calls).toEqual([
			"build-output",
			"cli:arkpack pack-official",
		]);
	});
});
