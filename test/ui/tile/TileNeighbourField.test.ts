// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const rect = (left: number, top: number, width = 100, height = 100): DOMRect => ({
	left,
	top,
	width,
	height,
	right: left + width,
	bottom: top + height,
	x: left,
	y: top,
	toJSON: () => ({}),
});

const motionTarget = () => {
	let value = 0;
	return {
		set: (next: number) => {
			value = next;
		},
		read: () => value,
	};
};

const actorNode = ({
	bounds,
	surfaceId = "board:0",
	live = true,
	phase = "idle",
}: {
	readonly bounds: DOMRect;
	readonly surfaceId?: string;
	readonly live?: boolean;
	readonly phase?: string;
}) => {
	const node = document.createElement("button");
	node.dataset.surfaceId = surfaceId;
	node.dataset.live = live ? "true" : "false";
	node.dataset.motionPhase = phase;
	node.getBoundingClientRect = () => bounds;
	return node;
};

type NeighbourField = ReturnType<typeof useTileNeighbourField>;
let field: NeighbourField | null = null;

const Capture = () => {
	field = useTileNeighbourField();
	return null;
};

const renderField = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(Capture));
	});
	if (field === null) throw new Error("Neighbour field was not captured.");
	return field;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	field = null;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("Tile neighbour field", () => {
	it("pushes only nearby live actors away with bounded distance falloff", async () => {
		const neighbourField = await renderField();
		const sourceX = motionTarget();
		const sourceY = motionTarget();
		const rightX = motionTarget();
		const rightY = motionTarget();
		const leftX = motionTarget();
		const leftY = motionTarget();
		const farX = motionTarget();
		const farY = motionTarget();

		neighbourField.registerNeighbourActor({
			itemId: "source",
			node: actorNode({ bounds: rect(0, 0) }),
			x: sourceX,
			y: sourceY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "right",
			node: actorNode({ bounds: rect(100, 0) }),
			x: rightX,
			y: rightY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "left",
			node: actorNode({ bounds: rect(-100, 0) }),
			x: leftX,
			y: leftY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "far",
			node: actorNode({ bounds: rect(400, 0) }),
			x: farX,
			y: farY,
			enabled: true,
		});

		neighbourField.moveNeighbourField({
			sourceItemId: "source",
			targetItemId: null,
			x: 50,
			y: 50,
		});

		expect(rightX.read()).toBeGreaterThan(0);
		expect(leftX.read()).toBeLessThan(0);
		expect(Math.abs(rightX.read())).toBeLessThanOrEqual(12);
		expect(Math.abs(leftX.read())).toBeLessThanOrEqual(12);
		expect(rightY.read()).toBe(0);
		expect(leftY.read()).toBe(0);
		expect(farX.read()).toBe(0);
		expect(farY.read()).toBe(0);
		expect(sourceX.read()).toBe(0);
		expect(sourceY.read()).toBe(0);
	});

	it("suppresses direct targets, other surfaces, exiting actors, and zero-distance vectors", async () => {
		const neighbourField = await renderField();
		const directX = motionTarget();
		const directY = motionTarget();
		const otherSurfaceX = motionTarget();
		const otherSurfaceY = motionTarget();
		const exitingX = motionTarget();
		const exitingY = motionTarget();
		const coincidentX = motionTarget();
		const coincidentY = motionTarget();

		neighbourField.registerNeighbourActor({
			itemId: "source",
			node: actorNode({ bounds: rect(0, 0) }),
			x: motionTarget(),
			y: motionTarget(),
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "direct",
			node: actorNode({ bounds: rect(100, 0) }),
			x: directX,
			y: directY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "other-surface",
			node: actorNode({ bounds: rect(100, 0), surfaceId: "toolbar" }),
			x: otherSurfaceX,
			y: otherSurfaceY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "exiting",
			node: actorNode({ bounds: rect(-100, 0), phase: "exiting" }),
			x: exitingX,
			y: exitingY,
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "coincident",
			node: actorNode({ bounds: rect(0, 0) }),
			x: coincidentX,
			y: coincidentY,
			enabled: true,
		});

		neighbourField.moveNeighbourField({
			sourceItemId: "source",
			targetItemId: "direct",
			x: 50,
			y: 50,
		});

		for (const target of [
			directX,
			directY,
			otherSurfaceX,
			otherSurfaceY,
			exitingX,
			exitingY,
			coincidentX,
			coincidentY,
		]) {
			expect(target.read()).toBe(0);
			expect(Number.isFinite(target.read())).toBe(true);
		}
	});

	it("clears the field when actor measurement fails", async () => {
		const neighbourField = await renderField();
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const neighbourX = motionTarget();
		const neighbourY = motionTarget();
		const broken = actorNode({ bounds: rect(0, 0) });
		broken.getBoundingClientRect = () => {
			throw new Error("measurement failed");
		};
		neighbourX.set(6);
		neighbourY.set(-4);
		neighbourField.registerNeighbourActor({
			itemId: "source",
			node: broken,
			x: motionTarget(),
			y: motionTarget(),
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "neighbour",
			node: actorNode({ bounds: rect(100, 0) }),
			x: neighbourX,
			y: neighbourY,
			enabled: true,
		});

		expect(() =>
			neighbourField.moveNeighbourField({
				sourceItemId: "source",
				targetItemId: null,
				x: 50,
				y: 50,
			}),
		).not.toThrow();
		expect(neighbourX.read()).toBe(0);
		expect(neighbourY.read()).toBe(0);
		expect(consoleError).toHaveBeenCalledOnce();
	});

	it("returns every registered actor to zero on clear", async () => {
		const neighbourField = await renderField();
		const neighbourX = motionTarget();
		const neighbourY = motionTarget();
		neighbourField.registerNeighbourActor({
			itemId: "source",
			node: actorNode({ bounds: rect(0, 0) }),
			x: motionTarget(),
			y: motionTarget(),
			enabled: true,
		});
		neighbourField.registerNeighbourActor({
			itemId: "neighbour",
			node: actorNode({ bounds: rect(100, 0) }),
			x: neighbourX,
			y: neighbourY,
			enabled: true,
		});
		neighbourField.moveNeighbourField({
			sourceItemId: "source",
			targetItemId: null,
			x: 50,
			y: 50,
		});
		expect(neighbourX.read()).not.toBe(0);

		neighbourField.clearNeighbourField();

		expect(neighbourX.read()).toBe(0);
		expect(neighbourY.read()).toBe(0);
	});
});
