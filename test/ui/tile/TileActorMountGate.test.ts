// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorMountGate } from "~/ui/tile/useTileActorMountGate";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const gameState = vi.hoisted(() => ({
	game: {} as object,
}));

vi.mock("~/bridge/game/useGameEngine", () => ({
	useGameEngine: () => gameState.game,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
let pendingFrame: FrameRequestCallback | null = null;

const actor = (id: string): useTileActors.Item => ({
	id,
	revision: `revision:${id}`,
	itemId: `item:${id}`,
	title: id,
	quantity: 1,
	sourceUrl: `asset://${id}`,
	location: {
		scope: "board",
		space: 0,
		position: { x: 0, y: 0 },
	},
	running: false,
	primaryAction: { kind: "none" },
});

const finishFrame = async () => {
	const frame = pendingFrame;
	pendingFrame = null;
	if (frame === null) throw new Error("Missing scheduled animation frame.");
	await act(async () => frame(performance.now()));
};

describe("useTileActorMountGate", () => {
	beforeEach(() => {
		gameState.game = {};
		pendingFrame = null;
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			pendingFrame = callback;
			return 1;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {
			pendingFrame = null;
		});
	});

	afterEach(async () => {
		await act(async () => {
			for (const root of roots.splice(0)) root.unmount();
		});
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it("shows the initial snapshot immediately and gates later uncued additions", async () => {
		let visible: ReadonlyArray<useTileActors.Item> = [];
		let liveItems = [actor("runtime:existing")];
		const cues = new Map<string, TileMotionCueSchema.Type>();
		const Capture = () => {
			visible = useTileActorMountGate({ liveItems, cues });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		expect(visible.map((item) => item.id)).toEqual(["runtime:existing"]);
		expect(pendingFrame).toBeNull();

		liveItems = [actor("runtime:existing"), actor("runtime:new")];
		await act(async () => root.render(createElement(Capture)));

		expect(visible.map((item) => item.id)).toEqual(["runtime:existing"]);
		expect(pendingFrame).not.toBeNull();
		await finishFrame();
		expect(visible.map((item) => item.id)).toEqual(["runtime:existing", "runtime:new"]);
	});

	it("prunes released identities after they leave the live actor set", async () => {
		let visible: ReadonlyArray<useTileActors.Item> = [];
		let liveItems = [actor("runtime:reused")];
		const cues = new Map<string, TileMotionCueSchema.Type>();
		const Capture = () => {
			visible = useTileActorMountGate({ liveItems, cues });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		expect(visible.map((item) => item.id)).toEqual(["runtime:reused"]);

		liveItems = [];
		await act(async () => root.render(createElement(Capture)));
		expect(visible).toEqual([]);

		liveItems = [actor("runtime:reused")];
		await act(async () => root.render(createElement(Capture)));
		expect(visible).toEqual([]);
		expect(pendingFrame).not.toBeNull();
		await finishFrame();
		expect(visible.map((item) => item.id)).toEqual(["runtime:reused"]);
	});

	it("releases a replacement Game snapshot immediately", async () => {
		let visible: ReadonlyArray<useTileActors.Item> = [];
		let liveItems = [actor("runtime:old")];
		const cues = new Map<string, TileMotionCueSchema.Type>();
		const Capture = () => {
			visible = useTileActorMountGate({ liveItems, cues });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		expect(visible.map((item) => item.id)).toEqual(["runtime:old"]);

		gameState.game = {};
		liveItems = [actor("runtime:new-game")];
		await act(async () => root.render(createElement(Capture)));

		expect(visible.map((item) => item.id)).toEqual(["runtime:new-game"]);
		expect(pendingFrame).toBeNull();
	});

	it("reveals a semantically cued spawn on its first rendered pose", async () => {
		let visible: ReadonlyArray<useTileActors.Item> = [];
		let liveItems: ReadonlyArray<useTileActors.Item> = [];
		const cues = new Map<string, TileMotionCueSchema.Type>([
			[
				"runtime:spawn",
				{
					generation: 1,
					kind: "spawn",
					strength: 1,
				},
			],
		]);
		const Capture = () => {
			visible = useTileActorMountGate({ liveItems, cues });
			return null;
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(Capture)));
		expect(visible).toEqual([]);

		liveItems = [actor("runtime:spawn")];
		await act(async () => root.render(createElement(Capture)));
		expect(visible.map((item) => item.id)).toEqual(["runtime:spawn"]);
		expect(pendingFrame).toBeNull();
	});
});
