import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("../../cli/desktop/cleanDesktopPackagingFx", () => ({
	cleanDesktopPackagingFx: () => Effect.sync(() => calls.push("clean")),
}));
vi.mock("../../cli/desktop/buildDesktopFx", () => ({
	buildDesktopFx: () => Effect.sync(() => calls.push("build")),
}));
vi.mock("../../cli/desktop/stageDesktopPackageFx", () => ({
	stageDesktopPackageFx: () => Effect.sync(() => calls.push("stage")),
}));
vi.mock("../../cli/desktop/runDesktopCommandFx", () => ({
	runDesktopCommandFx: ({ args }: { readonly args: ReadonlyArray<string> }) =>
		Effect.sync(() => calls.push(`package:${args.join(" ")}`)),
}));
vi.mock("../../cli/desktop/createDesktopChecksumsFx", () => ({
	createDesktopChecksumsFx: () => Effect.sync(() => calls.push("checksums")),
}));
vi.mock("../../cli/desktop/verifyDesktopArtifactsFx", () => ({
	verifyDesktopArtifactsFx: () => Effect.sync(() => calls.push("verify")),
}));

import { packageDesktopMacFx } from "../../cli/desktop/packageDesktopMacFx";

describe("packageDesktopMacFx", () => {
	it("owns the complete macOS packaging order as one Effect workflow", async () => {
		calls.length = 0;
		await Effect.runPromise(
			packageDesktopMacFx({
				arch: "arm64",
			}).pipe(Effect.provide(NodeContext.layer)),
		);

		expect(calls).toEqual([
			"clean",
			"build",
			"stage",
			"package:--config electron-builder.yml --mac --arm64 --publish never",
			"checksums",
			"verify",
		]);
	});
});
