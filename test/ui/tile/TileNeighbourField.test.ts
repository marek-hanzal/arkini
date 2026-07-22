// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const rect = (left: number, top: number, width = 80, height = 80): DOMRect => ({
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

const motionTarget = (initial = 0) => {
	let value = initial;
	return {
		get: () => value,
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
	exiting = false,
}: {
	readonly bounds: DOMRect | (() => DOMRect);
	readonly surfaceId?: string;
	readonly live?: boolean;
	readonly exiting?: boolean;
}) => {
	const node = document.createElement("span");
	node.dataset.surfaceId = surfaceId;
	node.dataset.live = live ? "true" : "false";
	node.dataset.motionExiting = exiting ? "true" : "false";
	node.getBoundingClientRect = () => (typeof bounds === "function" ? bounds() : bounds);
	return node;
};

const dragSource = (
	itemId: string,
	position: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
): TileDragSource => ({
	id: itemId,
	revision: `revision:${itemId}`,
	location: {
		scope: "board",
		space: 0,
		position,
	},
	surface: {
		id: "board:0",
		kind: "board",
		space: 0,
	},
	slot: {
		id: `${position.x}:${position.y}`,
		x: position.x,
		y: position.y,
	},
});

type NeighbourField = ReturnType<typeof useTileNeighbourField>;
let field: NeighbourField | null = null;
let previewKindByTarget = new Map<string, useDropItemPreview.Result["kind"]>();
let previewSequence = 0;
const refreshActivePreview = vi.fn();

const readPreview = (
	_source: TileDragSource,
	target: TileDropTarget,
): useDropItemPreview.Result | null => {
	const targetId = target.kind === "slot" ? target.occupant?.id : undefined;
	const kind = targetId === undefined ? undefined : previewKindByTarget.get(targetId);
	return kind === undefined ? null : ({ kind } as useDropItemPreview.Result);
};

const Capture = () => {
	field = useTileNeighbourField({
		readPreview,
		readPreviewSequence: () => previewSequence,
		refreshActivePreview,
	});
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

const register = (
	neighbourField: NeighbourField,
	itemId: string,
	node: HTMLElement,
	{
		x = motionTarget(),
		y = motionTarget(),
		scale = motionTarget(1),
		appliedX = x,
		appliedY = y,
		appliedScale = scale,
		canonicalWidth = motionTarget(100),
		canonicalHeight = motionTarget(100),
		enabled = true,
		source = dragSource(itemId),
	}: {
		readonly x?: ReturnType<typeof motionTarget>;
		readonly y?: ReturnType<typeof motionTarget>;
		readonly scale?: ReturnType<typeof motionTarget>;
		readonly appliedX?: ReturnType<typeof motionTarget>;
		readonly appliedY?: ReturnType<typeof motionTarget>;
		readonly appliedScale?: ReturnType<typeof motionTarget>;
		readonly canonicalWidth?: ReturnType<typeof motionTarget>;
		readonly canonicalHeight?: ReturnType<typeof motionTarget>;
		readonly enabled?: boolean;
		readonly source?: TileDragSource;
	} = {},
) => {
	neighbourField.registerNeighbourActor({
		itemId,
		node,
		source,
		x,
		y,
		appliedX,
		appliedY,
		scale,
		appliedScale,
		canonicalWidth,
		canonicalHeight,
		enabled,
	});
	return { x, y, scale };
};

beforeEach(() => {
	vi.useFakeTimers();
	previewKindByTarget = new Map();
	previewSequence = 0;
	refreshActivePreview.mockReset();
	refreshActivePreview.mockReturnValue(null);
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	field = null;
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("Tile neighbour field", () => {
	it("pushes nearby actors from the travelling body's actual current center", async () => {
		const neighbourField = await renderField();
		let sourceBounds = rect(0, 0);
		const source = register(
			neighbourField,
			"source",
			actorNode({ bounds: () => sourceBounds }),
		);
		const right = register(
			neighbourField,
			"right",
			actorNode({ bounds: rect(80, 0) }),
		);
		const left = register(
			neighbourField,
			"left",
			actorNode({ bounds: rect(-80, 0) }),
		);
		const far = register(
			neighbourField,
			"far",
			actorNode({ bounds: rect(400, 0) }),
		);

		const endTravel = neighbourField.beginNeighbourTravel("source");

		expect(right.x.read()).toBeGreaterThan(0);
		expect(left.x.read()).toBeLessThan(0);
		expect(Math.abs(right.x.read())).toBeLessThanOrEqual(16);
		expect(Math.abs(left.x.read())).toBeLessThanOrEqual(16);
		expect(right.y.read()).toBe(0);
		expect(left.y.read()).toBe(0);
		expect(far.x.read()).toBe(0);
		expect(source.x.read()).toBe(0);

		sourceBounds = rect(320, 0);
		neighbourField.refreshNeighbourField();
		expect(right.x.read()).toBe(0);
		expect(left.x.read()).toBe(0);
		endTravel();
	});

	it("suppresses direct targets, other surfaces, exiting actors, and zero vectors", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const direct = register(
			neighbourField,
			"direct",
			actorNode({ bounds: rect(80, 0) }),
		);
		const otherSurface = register(
			neighbourField,
			"other-surface",
			actorNode({ bounds: rect(80, 0), surfaceId: "toolbar" }),
			{
				source: {
					...dragSource("other-surface"),
					surface: { id: "toolbar", kind: "toolbar" },
				},
			},
		);
		const exiting = register(
			neighbourField,
			"exiting",
			actorNode({ bounds: rect(-80, 0), exiting: true }),
		);
		const coincident = register(
			neighbourField,
			"coincident",
			actorNode({ bounds: rect(0, 0) }),
		);

		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "direct",
			feedback: "rejected",
		});
		neighbourField.beginNeighbourTravel("source");

		for (const target of [direct, otherSurface, exiting, coincident]) {
			expect(target.x.read()).toBe(0);
			expect(target.y.read()).toBe(0);
			expect(Number.isFinite(target.x.read())).toBe(true);
		}
	});

	it("combines independent movers with a final cap and keeps the survivor active", async () => {
		const neighbourField = await renderField();
		const sourceA = register(
			neighbourField,
			"source-a",
			actorNode({ bounds: rect(0, 0) }),
		);
		const sourceB = register(
			neighbourField,
			"source-b",
			actorNode({ bounds: rect(30, 0) }),
		);
		const neighbour = register(
			neighbourField,
			"neighbour",
			actorNode({ bounds: rect(80, 0) }),
		);

		const endA = neighbourField.beginNeighbourTravel("source-a");
		const endB = neighbourField.beginNeighbourTravel("source-b");
		expect(sourceA.x.read()).toBeLessThan(0);
		expect(sourceB.x.read()).toBeGreaterThan(0);
		expect(neighbour.x.read()).toBeGreaterThan(0);
		expect(Math.hypot(neighbour.x.read(), neighbour.y.read())).toBeLessThanOrEqual(18);

		endA();
		expect(neighbour.x.read()).toBeGreaterThan(0);
		endB();
		expect(neighbour.x.read()).toBe(0);
		expect(neighbour.y.read()).toBe(0);
	});

	it("does not recursively feed applied displacement or compatibility scale into geometry", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const neighbourX = motionTarget();
		const neighbourY = motionTarget();
		const neighbourScale = motionTarget(1);
		register(
			neighbourField,
			"neighbour",
			actorNode({
				bounds: () =>
					rect(
						80 + neighbourX.get() - (80 * (neighbourScale.get() - 1)) / 2,
						-(80 * (neighbourScale.get() - 1)) / 2,
						80 * neighbourScale.get(),
						80 * neighbourScale.get(),
					),
			}),
			{
				x: neighbourX,
				y: neighbourY,
				scale: neighbourScale,
			},
		);
		neighbourField.beginNeighbourTravel("source");
		const first = neighbourX.read();

		neighbourScale.set(1.15);
		neighbourField.refreshNeighbourField();

		expect(neighbourX.read()).toBeCloseTo(first, 8);
	});

	it("grows compatible drag candidates and makes incompatible neighbours yield", async () => {
		const neighbourField = await renderField();
		previewKindByTarget.set("compatible", DropItemResultKindEnumSchema.enum.StoreInput);
		previewKindByTarget.set("incompatible", DropItemResultKindEnumSchema.enum.Swap);
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const compatible = register(
			neighbourField,
			"compatible",
			actorNode({ bounds: rect(80, 0) }),
		);
		const incompatible = register(
			neighbourField,
			"incompatible",
			actorNode({ bounds: rect(-80, 0) }),
		);

		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.beginNeighbourTravel("source");

		expect(compatible.scale.read()).toBeGreaterThan(1);
		expect(compatible.x.read()).toBe(0);
		expect(incompatible.scale.read()).toBe(1);
		expect(incompatible.x.read()).toBeLessThan(0);
	});

	it("invalidates cached drag candidates after a committed transition", async () => {
		const neighbourField = await renderField();
		previewKindByTarget.set("candidate", DropItemResultKindEnumSchema.enum.StoreInput);
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const candidate = register(
			neighbourField,
			"candidate",
			actorNode({ bounds: rect(80, 0) }),
		);
		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "candidate",
			feedback: "accepted",
		});
		neighbourField.beginNeighbourTravel("source");
		expect(candidate.scale.read()).toBe(1);
		expect(candidate.x.read()).toBe(0);

		previewKindByTarget.set("candidate", DropItemResultKindEnumSchema.enum.Swap);
		refreshActivePreview.mockReturnValue({
			sourceItemId: "source",
			targetItemId: "candidate",
			previewKind: DropItemResultKindEnumSchema.enum.Swap,
		});
		previewSequence += 1;
		neighbourField.refreshNeighbourField();

		expect(refreshActivePreview).toHaveBeenCalledOnce();
		expect(candidate.scale.read()).toBe(1);
		expect(candidate.x.read()).toBeGreaterThan(0);
	});

	it("caps candidate growth at the absolute visual-body limit", async () => {
		const neighbourField = await renderField();
		previewKindByTarget.set("candidate", DropItemResultKindEnumSchema.enum.StoreInput);
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const candidate = register(
			neighbourField,
			"candidate",
			actorNode({ bounds: rect(-5, 0, 90, 90) }),
		);
		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.beginNeighbourTravel("source");

		expect(0.9 * candidate.scale.read()).toBeGreaterThan(0.95);
		expect(0.9 * candidate.scale.read()).toBeLessThanOrEqual(0.96);
	});

	it("leaves merge and rejected direct-target scale to their interaction owner", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const target = register(
			neighbourField,
			"target",
			actorNode({ bounds: rect(80, 0, 75, 75) }),
		);
		const endTravel = neighbourField.beginNeighbourTravel("source");

		for (const feedback of ["merge", "rejected"] as const) {
			const releaseTarget = neighbourField.setNeighbourTravelTarget("source", {
				itemId: "target",
				feedback,
			});
			neighbourField.refreshNeighbourField();
			expect(target.scale.read()).toBe(1);
			expect(target.x.read()).toBe(0);
			releaseTarget();
		}
		endTravel();
	});

	it("uses actual post-release distance for accepted-target arrival anticipation", async () => {
		const neighbourField = await renderField();
		let sourceBounds = rect(-240, 0);
		register(
			neighbourField,
			"source",
			actorNode({ bounds: () => sourceBounds }),
		);
		const target = register(
			neighbourField,
			"target",
			actorNode({ bounds: rect(80, 0) }),
		);
		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "target",
			feedback: "accepted",
		});
		neighbourField.beginNeighbourTravel("source");
		expect(target.scale.read()).toBe(1);

		sourceBounds = rect(10, 0);
		neighbourField.refreshNeighbourField();
		expect(target.scale.read()).toBeGreaterThan(1);
		expect(target.scale.read()).toBeLessThanOrEqual(1.2);
		expect(target.x.read()).toBe(0);
	});

	it("leaves active-drag direct-target scale to the interaction owner", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const target = register(
			neighbourField,
			"target",
			actorNode({ bounds: rect(80, 0) }),
		);
		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "target",
			feedback: "accepted",
		});
		neighbourField.beginNeighbourTravel("source");

		expect(target.scale.read()).toBe(1);
		expect(target.x.read()).toBe(0);

		neighbourField.setNeighbourSemanticSource("source", null);
		neighbourField.refreshNeighbourField();
		expect(target.scale.read()).toBeGreaterThan(1);
	});

	it("preserves the exact target across a same-commit mover handoff", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const target = register(
			neighbourField,
			"target",
			actorNode({ bounds: rect(80, 0) }),
		);
		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "target",
			feedback: "accepted",
		});
		const endDragTravel = neighbourField.beginNeighbourTravel("source");
		endDragTravel();
		const endSettlementTravel = neighbourField.beginNeighbourTravel("source");

		await act(async () => Promise.resolve());
		neighbourField.refreshNeighbourField();
		expect(target.scale.read()).toBeGreaterThan(1);

		endSettlementTravel();
		await act(async () => Promise.resolve());
		neighbourField.refreshNeighbourField();
		expect(target.scale.read()).toBe(1);
	});

	it("does not let stale target cleanup clear a newer mover target", async () => {
		const neighbourField = await renderField();
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const staleTarget = register(
			neighbourField,
			"stale-target",
			actorNode({ bounds: rect(-80, 0) }),
		);
		const currentTarget = register(
			neighbourField,
			"current-target",
			actorNode({ bounds: rect(80, 0) }),
		);
		const releaseStaleTarget = neighbourField.setNeighbourTravelTarget("source", {
			itemId: "stale-target",
			feedback: "rejected",
		});
		neighbourField.setNeighbourTravelTarget("source", {
			itemId: "current-target",
			feedback: "accepted",
		});
		neighbourField.beginNeighbourTravel("source");

		releaseStaleTarget();
		neighbourField.refreshNeighbourField();

		expect(currentTarget.scale.read()).toBeGreaterThan(1);
		expect(currentTarget.x.read()).toBe(0);
		expect(staleTarget.x.read()).toBeLessThan(0);
	});

	it("disables semantic crowd work for a reduced-motion source", async () => {
		const neighbourField = await renderField();
		previewKindByTarget.set("candidate", DropItemResultKindEnumSchema.enum.StoreInput);
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }), {
			enabled: false,
		});
		const candidate = register(
			neighbourField,
			"candidate",
			actorNode({ bounds: rect(80, 0) }),
		);

		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.refreshNeighbourField();

		expect(candidate.scale.read()).toBe(1);
		expect(candidate.x.read()).toBe(0);
	});

	it("clears every displacement and scale when actor measurement fails", async () => {
		const neighbourField = await renderField();
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const broken = actorNode({ bounds: rect(0, 0) });
		broken.getBoundingClientRect = () => {
			throw new Error("measurement failed");
		};
		register(neighbourField, "source", broken);
		const neighbour = register(
			neighbourField,
			"neighbour",
			actorNode({ bounds: rect(80, 0) }),
			{
				x: motionTarget(6),
				y: motionTarget(-4),
				scale: motionTarget(1.12),
			},
		);

		expect(() => neighbourField.beginNeighbourTravel("source")).not.toThrow();
		expect(neighbour.x.read()).toBe(0);
		expect(neighbour.y.read()).toBe(0);
		expect(neighbour.scale.read()).toBe(1);
		expect(consoleError).toHaveBeenCalledOnce();
	});

	it("clears movers, targets, candidates, and every actor on scene reset", async () => {
		const neighbourField = await renderField();
		previewKindByTarget.set("neighbour", DropItemResultKindEnumSchema.enum.StoreInput);
		register(neighbourField, "source", actorNode({ bounds: rect(0, 0) }));
		const neighbour = register(
			neighbourField,
			"neighbour",
			actorNode({ bounds: rect(80, 0) }),
		);
		neighbourField.setNeighbourSemanticSource("source", dragSource("source"));
		neighbourField.beginNeighbourTravel("source");
		expect(neighbour.scale.read()).not.toBe(1);

		neighbourField.clearNeighbourField();

		expect(neighbour.x.read()).toBe(0);
		expect(neighbour.y.read()).toBe(0);
		expect(neighbour.scale.read()).toBe(1);
		neighbourField.refreshNeighbourField();
		expect(neighbour.scale.read()).toBe(1);
	});
});
