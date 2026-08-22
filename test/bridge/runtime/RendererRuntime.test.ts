import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { afterAll, describe, expect, it } from "vitest";

import { EditorBoardGameResourceOwnerAtom } from "~/bridge/editor/board/EditorBoardGameResource";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

afterAll(async () => {
	await RendererRuntime.dispose();
});

describe("RendererRuntime", () => {
	it("constructs synchronously before the lazy editor database is opened", () => {
		expect(RendererRuntime.runSync(Effect.succeed("ready"))).toBe("ready");
		const editorBoardGame = RendererRuntime.runSync(Atom.get(EditorBoardGameResourceOwnerAtom));
		expect(editorBoardGame).toBeDefined();
		if (editorBoardGame === undefined) return;
		expect(RendererRuntime.runSync(SubscriptionRef.get(editorBoardGame.state))).toEqual({
			type: "idle",
		});
	});
});
