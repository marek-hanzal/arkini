// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileSystem } from "~/ui/tile/TileSystemContext";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileActorMotion } from "~/ui/tile/useTileActorMotion";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

const systemState = vi.hoisted(() => ({
	system: null as TileSystem | null,
}));

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));
vi.mock("~/ui/tile/useTileActorSystem", () => ({
	useTileActorSystem: () => {
		if (systemState.system === null) throw new Error("Missing test Tile System.");
		return systemState.system;
	},
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
let capturedMotion: ReturnType<typeof useTileActorMotion> | null = null;

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
	capturedMotion = useTileActorMotion({
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
	motionTestRuntime.reset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	systemState.system = null;
	capturedMotion = null;
	document.body.replaceChildren();
});

describe("useTileActorMotion", () => {
	it("bounds the real actor behind its pointer target through a spring follower", async () => {
		motionTestRuntime.springLag = true;
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: { x: 0, y: 0 },
		};

		await renderMotion(item(location), presentation(location, 1));
		if (capturedMotion === null) throw new Error("Tile actor motion was not captured.");
		capturedMotion.dragX.set(100);
		capturedMotion.dragY.set(-100);

		expect(capturedMotion.travelX.get()).toBe(72);
		expect(capturedMotion.travelY.get()).toBe(-76);
	});

	it("removes spring lag under reduced motion without changing pointer semantics", async () => {
		motionTestRuntime.springLag = true;
		motionTestRuntime.reducedMotion = true;
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: { x: 0, y: 0 },
		};

		await renderMotion(item(location), presentation(location, 1));
		if (capturedMotion === null) throw new Error("Tile actor motion was not captured.");
		capturedMotion.dragX.set(100);
		capturedMotion.dragY.set(-100);

		expect(capturedMotion.travelX.get()).toBe(100);
		expect(capturedMotion.travelY.get()).toBe(-100);
	});

	it("owns crowd travel for real spatial settlement and releases the exact mover", async () => {
		const beginNeighbourTravel = vi.fn();
		const endNeighbourTravel = vi.fn();
		beginNeighbourTravel.mockReturnValue(endNeighbourTravel);
		let placement = { x: 0, y: 0, width: 100, height: 100 };
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
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
		const rendered = await renderMotion(item(currentLocation), presentation(currentLocation, 1));

		placement = { x: 100, y: 0, width: 100, height: 100 };
		await rendered.rerender(presentation(targetLocation, 2));
		await act(async () => undefined);

		expect(beginNeighbourTravel).toHaveBeenCalledOnce();
		expect(beginNeighbourTravel).toHaveBeenCalledWith("runtime:water");
		expect(endNeighbourTravel).toHaveBeenCalledOnce();
	});

	it("does not create crowd travel for unchanged semantic placement", async () => {
		const beginNeighbourTravel = vi.fn(() => vi.fn());
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const location = {
			scope: "board" as const,
			space: 0,
			position: { x: 0, y: 0 },
		};
		const rendered = await renderMotion(item(location), presentation(location, 1));

		await rendered.rerender(presentation(location, 2));
		await act(async () => undefined);

		expect(beginNeighbourTravel).not.toHaveBeenCalled();
	});

	it("does not register crowd travel under reduced motion", async () => {
		motionTestRuntime.reducedMotion = true;
		const beginNeighbourTravel = vi.fn(() => vi.fn());
		let placement = { x: 0, y: 0, width: 100, height: 100 };
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => placement,
			complete: () => undefined,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel,
		} as unknown as TileSystem;
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
		const rendered = await renderMotion(item(currentLocation), presentation(currentLocation, 1));

		placement = { x: 100, y: 0, width: 100, height: 100 };
		await rendered.rerender(presentation(targetLocation, 2));
		await act(async () => undefined);

		expect(beginNeighbourTravel).not.toHaveBeenCalled();
	});

	it("releases exact position ownership when placement remains unavailable", async () => {
		const complete = vi.fn();
		systemState.system = {
			geometryVersion: 0,
			readActorLayerRect: () => null,
			readActorRect: () => null,
			readPlacement: () => null,
			complete,
			registerNeighbourActor: () => () => undefined,
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
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
			beginNeighbourTravel: () => () => undefined,
		} as unknown as TileSystem;
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
