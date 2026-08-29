import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { afterAll, describe, expect, it } from "vitest";

import { EditorBoardGameResourceOwnerAtom } from "~/renderer/editor/board/EditorBoardGameResourceOwnerAtom";
import { RendererRuntime } from "~/renderer/RendererRuntime";

afterAll(async () => {
	await RendererRuntime.dispose();
});

describe("RendererRuntime", () => {
	it("constructs synchronously before the lazy Editor repository is opened", () => {
		expect(RendererRuntime.runSync(Effect.succeed("ready"))).toBe("ready");
		const editorBoardGame = RendererRuntime.runSync(Atom.get(EditorBoardGameResourceOwnerAtom));
		expect(editorBoardGame).toBeDefined();
		if (editorBoardGame === undefined) return;
		expect(RendererRuntime.runSync(SubscriptionRef.get(editorBoardGame.state))).toEqual({
			type: "idle",
		});
	});
});
