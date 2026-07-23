// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TileSystem } from "~/ui/tile/TileSystem";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { useTileActorNeighbourMotion } from "~/ui/tile/useTileActorNeighbourMotion";
import { motionTestRuntime, useMotionValue } from "~test/ui/support/motionReactMock";

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
let neighbourMotion: ReturnType<typeof useTileActorNeighbourMotion> | null = null;

const source = (revision: string): TileDragSource => ({
	id: "runtime:actor",
	revision,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	surface: {
		id: "board:0",
		kind: "board",
		space: 0,
	},
	slot: {
		id: "0:0",
		x: 0,
		y: 0,
	},
});

const Capture = ({
	actorSource,
	visible,
}: {
	readonly actorSource: TileDragSource;
	readonly visible: boolean;
}) => {
	const width = useMotionValue(100);
	const height = useMotionValue(100);
	neighbourMotion = useTileActorNeighbourMotion({
		itemId: "runtime:actor",
		source: actorSource,
		visible,
		canonicalWidth: width as never,
		canonicalHeight: height as never,
	});
	return null;
};

const renderNeighbourMotion = async ({
	actorSource = source("revision:1"),
	visible = true,
}: {
	readonly actorSource?: TileDragSource;
	readonly visible?: boolean;
} = {}) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Capture, {
				actorSource,
				visible,
			}),
		);
	});
	if (neighbourMotion === null) throw new Error("Neighbour motion was not captured.");
	return {
		motion: neighbourMotion,
		rerender: async (next: {
			readonly actorSource: TileDragSource;
			readonly visible: boolean;
		}) => {
			await act(async () => {
				root.render(createElement(Capture, next));
			});
			if (neighbourMotion === null) throw new Error("Neighbour motion was not captured.");
			return neighbourMotion;
		},
	};
};

beforeEach(() => {
	motionTestRuntime.reset();
	systemState.system = null;
	neighbourMotion = null;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("useTileActorNeighbourMotion", () => {
	it("keeps one stable node registration while updating actor metadata", async () => {
		const unregister = vi.fn();
		const registerNeighbourActor = vi.fn(() => unregister);
		const updateNeighbourActor = vi.fn();
		systemState.system = {
			registerNeighbourActor,
			updateNeighbourActor,
			beginNeighbourTravel: vi.fn(() => vi.fn()),
		} as unknown as TileSystem;
		const rendered = await renderNeighbourMotion();
		const node = document.createElement("span");
		const registerActorNode = rendered.motion.registerActorNode;

		await act(async () => registerActorNode(node));
		expect(registerNeighbourActor).toHaveBeenCalledOnce();
		expect(registerNeighbourActor.mock.calls[0]?.[0]).toMatchObject({
			itemId: "runtime:actor",
			node,
			source: source("revision:1"),
			enabled: true,
		});

		const updated = await rendered.rerender({
			actorSource: source("revision:2"),
			visible: false,
		});
		expect(updated.registerActorNode).toBe(registerActorNode);
		expect(registerNeighbourActor).toHaveBeenCalledOnce();
		expect(unregister).not.toHaveBeenCalled();
		expect(updateNeighbourActor).toHaveBeenLastCalledWith({
			itemId: "runtime:actor",
			source: source("revision:2"),
			enabled: false,
		});

		await act(async () => registerActorNode(node));
		expect(registerNeighbourActor).toHaveBeenCalledOnce();
		await act(async () => registerActorNode(null));
		expect(unregister).toHaveBeenCalledOnce();
	});

	it("holds mover ownership until the final overlapping lease releases", async () => {
		const stopTravel = vi.fn();
		const beginNeighbourTravel = vi.fn(() => stopTravel);
		systemState.system = {
			registerNeighbourActor: vi.fn(() => vi.fn()),
			updateNeighbourActor: vi.fn(),
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const rendered = await renderNeighbourMotion();
		const releaseDrag = rendered.motion.retainTravel();
		const releaseSettlement = rendered.motion.retainTravel();

		expect(beginNeighbourTravel).toHaveBeenCalledOnce();
		expect(beginNeighbourTravel).toHaveBeenCalledWith("runtime:actor");
		releaseDrag();
		expect(stopTravel).not.toHaveBeenCalled();
		releaseDrag();
		expect(stopTravel).not.toHaveBeenCalled();
		releaseSettlement();
		expect(stopTravel).toHaveBeenCalledOnce();

		const releaseDelivery = rendered.motion.retainTravel();
		expect(beginNeighbourTravel).toHaveBeenCalledTimes(2);
		releaseDrag();
		expect(stopTravel).toHaveBeenCalledOnce();
		releaseDelivery();
		expect(stopTravel).toHaveBeenCalledTimes(2);
	});

	it("retains first-paint delivery before visibility publishes", async () => {
		const stopTravel = vi.fn();
		const beginNeighbourTravel = vi.fn(() => stopTravel);
		systemState.system = {
			registerNeighbourActor: vi.fn(() => vi.fn()),
			updateNeighbourActor: vi.fn(),
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const rendered = await renderNeighbourMotion({
			visible: false,
		});

		const releaseDelivery = rendered.motion.retainTravel();
		expect(beginNeighbourTravel).toHaveBeenCalledWith("runtime:actor");
		releaseDelivery();
		expect(stopTravel).toHaveBeenCalledOnce();
	});

	it("clears response and active leases under reduced motion, then starts cleanly", async () => {
		const stopTravel = vi.fn();
		const beginNeighbourTravel = vi.fn(() => stopTravel);
		const updateNeighbourActor = vi.fn();
		const registerNeighbourActor = vi.fn(() => vi.fn());
		systemState.system = {
			registerNeighbourActor,
			updateNeighbourActor,
			beginNeighbourTravel,
		} as unknown as TileSystem;
		const rendered = await renderNeighbourMotion();
		const node = document.createElement("span");
		await act(async () => rendered.motion.registerActorNode(node));
		const registration = registerNeighbourActor.mock.calls[0]?.[0];
		if (registration === undefined) throw new Error("Missing actor registration.");
		registration.x.set(8);
		registration.y.set(-6);
		registration.scale.set(1.12);
		rendered.motion.retainTravel();

		motionTestRuntime.reducedMotion = true;
		const reduced = await rendered.rerender({
			actorSource: source("revision:1"),
			visible: true,
		});
		expect(stopTravel).toHaveBeenCalledOnce();
		expect(reduced.values.x.get()).toBe(0);
		expect(reduced.values.y.get()).toBe(0);
		expect(reduced.values.scale.get()).toBe(1);
		expect(updateNeighbourActor).toHaveBeenLastCalledWith({
			itemId: "runtime:actor",
			source: source("revision:1"),
			enabled: false,
		});
		const releaseReduced = reduced.retainTravel();
		expect(beginNeighbourTravel).toHaveBeenCalledOnce();
		releaseReduced();

		motionTestRuntime.reducedMotion = false;
		const restored = await rendered.rerender({
			actorSource: source("revision:1"),
			visible: true,
		});
		const releaseRestored = restored.retainTravel();
		expect(beginNeighbourTravel).toHaveBeenCalledTimes(2);
		releaseRestored();
	});

	it("unregisters the node, stops travel, and resets values on teardown", async () => {
		const unregister = vi.fn();
		const stopTravel = vi.fn();
		const registerNeighbourActor = vi.fn(() => unregister);
		systemState.system = {
			registerNeighbourActor,
			updateNeighbourActor: vi.fn(),
			beginNeighbourTravel: vi.fn(() => stopTravel),
		} as unknown as TileSystem;
		const rendered = await renderNeighbourMotion();
		await act(async () => rendered.motion.registerActorNode(document.createElement("span")));
		const registration = registerNeighbourActor.mock.calls[0]?.[0];
		if (registration === undefined) throw new Error("Missing actor registration.");
		registration.x.set(5);
		registration.scale.set(1.1);
		rendered.motion.retainTravel();

		await act(async () => roots[0]?.unmount());
		roots.splice(0, 1);

		expect(unregister).toHaveBeenCalledOnce();
		expect(stopTravel).toHaveBeenCalledOnce();
		expect(rendered.motion.values.x.get()).toBe(0);
		expect(rendered.motion.values.scale.get()).toBe(1);
	});
});
