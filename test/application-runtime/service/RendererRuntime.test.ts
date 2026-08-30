import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { afterAll, describe, expect, it } from "vitest";

import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/EditorUnsavedChangesOwnerAtom";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/session/EditorBoardGameResourceOwnerAtom";

afterAll(async () => {
	await RendererRuntime.dispose();
	expect(RendererAtomRegistry.get(EditorBoardGameResourceOwnerAtom)).toBeUndefined();
	expect(RendererAtomRegistry.get(EditorUnsavedChangesOwnerAtom)).toBeUndefined();
});

describe("RendererRuntime", () => {
	it("constructs synchronously before the lazy Editor repository is opened", () => {
		expect(RendererRuntime.runSync(Effect.succeed("ready"))).toBe("ready");
		expect(RendererRuntime.runSync(Atom.get(EditorUnsavedChangesOwnerAtom))).toBeDefined();
		const editorBoardGame = RendererRuntime.runSync(Atom.get(EditorBoardGameResourceOwnerAtom));
		expect(editorBoardGame).toBeDefined();
		if (editorBoardGame === undefined) return;
		expect(RendererRuntime.runSync(SubscriptionRef.get(editorBoardGame.state))).toEqual({
			type: "idle",
		});
	});
});
