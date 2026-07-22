// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileActorSystem } from "~/ui/tile/TileSystemContext";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const systemState = vi.hoisted(() => ({
	system: null as TileActorSystem | null,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => {
		if (systemState.system === null) throw new Error("Missing test Tile System.");
		return systemState.system;
	},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (location: useTileActors.Item["location"]): useTileActors.Item => ({
	id: "runtime:water",
	revision: "revision:water",
	itemId: "water",
	title: "Water",
	quantity: 1,
	sourceUrl: "arkini://water",
	location,
	running: false,
	primaryAction: { kind: "none" },
});

const source = (location: useTileActors.Item["location"]): TileDragSource => {
	const surface: TileSurface =
		location.scope === "board"
			? { id: `board:${location.space}`, kind: "board", space: location.space }
			: location.scope === "inventory"
				? { id: "inventory", kind: "inventory" }
				: { id: "toolbar", kind: "toolbar" };
	return {
		id: "runtime:water",
		revision: "revision:water",
		location,
		surface,
		slot: {
			id: `${location.position.x}:${location.position.y}`,
			x: location.position.x,
			y: location.position.y,
		},
	};
};

const presentation = (
	location: useTileActors.Item["location"],
	generation: number,
): useTileActorPresentation.Model => ({
	canonicalSource: source(location),
	desiredSource: source(location),
	phase: "settling",
	feedback: null,
	forbiddenDrop: false,
	zIndex: 30,
	placementFrozen: false,
	positionCompletion: {
		kind: "location",
		generation,
		location,
	},
	visualCompletionGeneration: null,
	hovered: false,
	setHovered: () => undefined,
});

const Capture = ({
	actor,
	view,
}: {
	readonly actor: useTileActors.Item;
	readonly view: useTileActorPresentation.Model;
}) => {
	useTileActorMotion({
		item: actor,
		presentation: view,
		cue: null,
	});
	return null;
};

const renderMotion = async (
	actor: useTileActors.Item,
	view: useTileActorPresentation.Model,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(Capture, { actor, view }));
	});
	return {
		rerender: async (nextView: useTileActorPresentation.Model) => {
			await act(async () => {
				root.render(createElement(Capture, { actor, view: nextView }));
			});
		},
	};
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	systemState.system = null;
	document.body.replaceChildren();
});

describe("useTileActorMotion", () => {
	it("releases exact position ownership when placement remains unavailable", async () => {
		const complete = vi.fn();
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => null,
			complete,
			registerNeighbourActor: () => () => undefined,
		} as unknown as TileActorSystem;
		const currentLocation = {
			scope: "board" as const,
			space: 0,
			position: { x: 0, y: 0 },
		};
		const targetLocation = {
			scope: "board" as const,
			space: 0,
			position: { x: 1, y: 0 },
		};
		const rendered = await renderMotion(item(currentLocation), presentation(targetLocation, 7));

		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).not.toHaveBeenCalled();

		await rendered.rerender(presentation(targetLocation, 8));
		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).not.toHaveBeenCalled();
		await act(async () => {
			vi.advanceTimersByTime(1_000);
		});
		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith("runtime:water", 8);
	});

	it("converges immediately when measurement fails after canonical location already committed", async () => {
		const complete = vi.fn();
		const error = new Error("measurement failed");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => {
				throw error;
			},
			complete,
			registerNeighbourActor: () => () => undefined,
		} as unknown as TileActorSystem;
		const location = {
			scope: "inventory" as const,
			position: { x: 1, y: 0 },
		};

		await renderMotion(item(location), presentation(location, 12));

		expect(complete).toHaveBeenCalledWith("runtime:water", 12);
		expect(consoleError).toHaveBeenCalledWith(
			"Tile placement measurement failed; keeping its last stable pose.",
			error,
		);
	});
});
