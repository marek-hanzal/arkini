import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	calls: [] as string[],
	failAt: undefined as string | undefined,
	appPath: "/tmp/release/mac-arm64/Arkini.app",
}));

const record = (name: string) =>
	state.failAt === name
		? Effect.fail(new Error(`failed:${name}`))
		: Effect.sync(() => state.calls.push(name));

vi.mock("../../cli/desktop/cleanDesktopPackagingFx", () => ({
	cleanDesktopPackagingFx: () => record("clean"),
}));
vi.mock("../../cli/desktop/buildDesktopFx", () => ({
	buildDesktopFx: () => record("build"),
}));
vi.mock("../../cli/desktop/stageDesktopPackageFx", () => ({
	stageDesktopPackageFx: () => record("stage"),
}));
vi.mock("../../cli/desktop/createUnpackedMacAppFx", () => ({
	createUnpackedMacAppFx: ({ arch }: { readonly arch: "arm64" }) =>
		record(`unpacked:${arch}`).pipe(Effect.as(state.appPath)),
}));
vi.mock("../../cli/desktop/openMacAppFx", () => ({
	openMacAppFx: ({ appPath }: { readonly appPath: string }) => record(`open:${appPath}`),
}));

import { previewDesktopMacFx } from "../../cli/desktop/previewDesktopMacFx";

describe("previewDesktopMacFx", () => {
	beforeEach(() => {
		state.calls.length = 0;
		state.failAt = undefined;
	});

	it("builds, creates and launches the exact unpacked macOS app", async () => {
		await Effect.runPromise(previewDesktopMacFx().pipe(Effect.provide(NodeContext.layer)));

		expect(state.calls).toEqual([
			"clean",
			"build",
			"stage",
			"unpacked:arm64",
			`open:${state.appPath}`,
		]);
	});

	it("does not launch after an earlier stage fails", async () => {
		state.failAt = "unpacked:arm64";

		await expect(
			Effect.runPromise(previewDesktopMacFx().pipe(Effect.provide(NodeContext.layer))),
		).rejects.toThrow("failed:unpacked:arm64");
		expect(state.calls).toEqual([
			"clean",
			"build",
			"stage",
		]);
	});
});
