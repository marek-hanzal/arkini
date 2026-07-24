import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../cli/desktop/packOfficialGameFx", () => ({
	packOfficialGameFx: ({ gameDirectory }: { readonly gameDirectory: string }) =>
		Effect.sync(() => calls.push(`pack:${gameDirectory}`)),
}));
vi.mock("../../cli/desktop/packDemoGameFx", () => ({
	packDemoGameFx: ({ gameDirectory }: { readonly gameDirectory: string }) =>
		Effect.sync(() => calls.push(`pack:${gameDirectory}`)),
}));
vi.mock("../../cli/desktop/buildDesktopOutputFx", () => ({
	buildDesktopOutputFx: () => Effect.sync(() => calls.push("build-output")),
}));

import { buildDesktopFx } from "../../cli/desktop/buildDesktopFx";

describe("buildDesktopFx", () => {
	it("packs the signed official game and unsigned demo before building Electron output", async () => {
		calls.length = 0;
		await Effect.runPromise(
			buildDesktopFx({
				gameDirectory: "game/arkini",
			}).pipe(Effect.provide(NodeContext.layer)),
		);

		expect(calls).toEqual([
			"pack:game/arkini",
			"pack:game/demo",
			"build-output",
		]);
	});
});
