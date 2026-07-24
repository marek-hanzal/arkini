// @vitest-environment jsdom

import { act, createElement, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { useTileActorInteraction } from "~/ui/tile/useTileActorInteraction";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import type { TileSystem } from "~/ui/tile/TileSystem";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { useTileSlot } from "~/ui/tile/useTileSlot";
import { useTileSurface } from "~/ui/tile/useTileSurface";
import { useTileInteractionState } from "~/ui/tile/useTileInteractionState";
import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

vi.mock("~/bridge/tile/useTileActors", () => ({
	useTileActors: () => [],
}));

const previewState = vi.hoisted(() => ({
	occupiedKind: "swap" as "swap" | "merge" | "stack" | "store-input",
	observedRevisions: [] as string[],
}));

vi.mock("~/bridge/tile/useDropItemPreview", () => ({
	useDropItemPreview:
		() =>
		(props: {
			readonly target:
				| {
						readonly kind: "unsupported";
				  }
				| {
						readonly kind: "slot";
						readonly occupant: {
							readonly revision: string;
						} | null;
				  };
		}) => {
			if (props.target.kind === "unsupported") {
				return {
					kind: "reject" as const,
					reason: "unsupported-target" as const,
				};
			}
			if (props.target.occupant !== null) {
				previewState.observedRevisions.push(props.target.occupant.revision);
			}
			return {
				kind:
					props.target.occupant === null ? ("move" as const) : previewState.occupiedKind,
			};
		},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const actorRenderCounts = new Map<string, number>();
const slotRenderCounts = new Map<string, number>();
let updateToolbarRevision: ((revision: string) => void) | null = null;

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
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

const boardSurface = {
	id: "board:0",
	kind: "board",
	space: 0,
} satisfies TileSurface;
const inventorySurface = {
	id: "inventory",
	kind: "inventory",
} satisfies TileSurface;
const toolbarSurface = {
	id: "toolbar",
	kind: "toolbar",
} satisfies TileSurface;
const sourceSlot = {
	id: "0:0",
	x: 0,
	y: 0,
} satisfies TileSlot;
const boardTopRightSlot = {
	id: "1:0",
	x: 1,
	y: 0,
} satisfies TileSlot;
const boardBottomLeftSlot = {
	id: "0:1",
	x: 0,
	y: 1,
} satisfies TileSlot;
const boardBottomRightSlot = {
	id: "1:1",
	x: 1,
	y: 1,
} satisfies TileSlot;
const inventorySlot = {
	id: "1:0",
	x: 1,
	y: 0,
} satisfies TileSlot;
const toolbarSlot = {
	id: "2:0",
	x: 2,
	y: 0,
} satisfies TileSlot;
const toolbarOccupant = {
	id: "runtime:toolbar",
	revision: "revision:toolbar",
} satisfies TileIdentity;
const source = {
	id: "runtime:source",
	revision: "revision:source",
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	surface: boardSurface,
	slot: sourceSlot,
} satisfies TileDragSource;

const SurfaceSlot = ({
	surface,
	slot,
	occupant = null,
}: {
	readonly surface: TileSurface;
	readonly slot: TileSlot;
	readonly occupant?: TileIdentity | null;
}) => {
	const renderKey = `${surface.id}:${slot.id}`;
	slotRenderCounts.set(renderKey, (slotRenderCounts.get(renderKey) ?? 0) + 1);
	const drop = useTileSlot({
		surface,
		slot,
		occupant,
	});
	return createElement("div", {
		ref: drop.ref,
		"data-slot": `${surface.kind}:${slot.id}`,
		"data-over": drop.over ? "true" : "false",
	});
};

const Surface = ({
	surface,
	slots,
}: {
	readonly surface: TileSurface;
	readonly slots: ReadonlyArray<{
		readonly slot: TileSlot;
		readonly occupant?: TileIdentity | null;
	}>;
}) => {
	const surfaceRef = useTileSurface(surface);
	return createElement(
		"div",
		{
			ref: surfaceRef,
			"data-surface": surface.kind,
		},
		...slots.map(({ slot, occupant }) =>
			createElement(SurfaceSlot, {
				key: slot.id,
				surface,
				slot,
				occupant,
			}),
		),
	);
};

const MutableToolbarSurface = () => {
	const [revision, setRevision] = useState(toolbarOccupant.revision);
	useEffect(() => {
		updateToolbarRevision = setRevision;
		return () => {
			updateToolbarRevision = null;
		};
	}, []);
	return createElement(Surface, {
		surface: toolbarSurface,
		slots: [
			{
				slot: toolbarSlot,
				occupant: {
					...toolbarOccupant,
					revision,
				},
			},
		],
	});
};

const ActorSelectionCapture = ({ itemId }: { readonly itemId: string }) => {
	const active = useTileActorInteraction(itemId);
	actorRenderCounts.set(itemId, (actorRenderCounts.get(itemId) ?? 0) + 1);
	return createElement("span", {
		"data-actor-selection": itemId,
		"data-active-phase": active?.phase,
	});
};

const Capture = ({ onSystem }: { readonly onSystem: (system: TileSystem) => void }) => {
	const api = useTileSystemApiContext();
	const active = useTileInteractionState();
	const system = useMemo<TileSystem>(
		() => ({
			...api,
			active,
		}),
		[
			active,
			api,
		],
	);
	useEffect(
		() => onSystem(system),
		[
			onSystem,
			system,
		],
	);
	return null;
};

const Harness = ({ onSystem }: { readonly onSystem: (system: TileSystem) => void }) =>
	createElement(
		TileSystemProvider,
		null,
		createElement(Capture, {
			onSystem,
		}),
		createElement(ActorSelectionCapture, {
			itemId: source.id,
		}),
		createElement(ActorSelectionCapture, {
			itemId: toolbarOccupant.id,
		}),
		createElement(ActorSelectionCapture, {
			itemId: "runtime:unrelated",
		}),
		createElement(Surface, {
			surface: boardSurface,
			slots: [
				{
					slot: sourceSlot,
				},
				{
					slot: boardTopRightSlot,
				},
				{
					slot: boardBottomLeftSlot,
				},
				{
					slot: boardBottomRightSlot,
				},
			],
		}),
		createElement(Surface, {
			surface: inventorySurface,
			slots: [
				{
					slot: inventorySlot,
				},
			],
		}),
		createElement(MutableToolbarSurface),
	);

beforeEach(() => {
	previewState.occupiedKind = "swap";
	previewState.observedRevisions.splice(0);
	actorRenderCounts.clear();
	slotRenderCounts.clear();
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value() {
			const element = this as HTMLElement;
			if (element.dataset.ui === "TileActorLayer") return rect(0, 0, 500, 200);
			if (element.dataset.surface === "board") return rect(0, 0, 100.5, 99.5);
			if (element.dataset.surface === "inventory") return rect(180, 0, 160, 120);
			if (element.dataset.surface === "toolbar") return rect(380, 0, 120, 100);
			if (element.dataset.slot === "board:0:0") return rect(0, 0, 50.25, 49.75);
			if (element.dataset.slot === "board:1:0") return rect(50.25, 0, 50.25, 49.75);
			if (element.dataset.slot === "board:0:1") return rect(0, 49.75, 50.25, 49.75);
			if (element.dataset.slot === "board:1:1") return rect(50.25, 49.75, 50.25, 49.75);
			if (element.dataset.slot?.startsWith("inventory:")) return rect(200, 20, 80, 80);
			if (element.dataset.slot?.startsWith("toolbar:")) return rect(400, 10, 80, 80);
			return rect(0, 0, 0, 0);
		},
	});
	Object.defineProperty(document, "elementsFromPoint", {
		configurable: true,
		value: vi.fn((x: number) => {
			if (x >= 200 && x < 280) {
				return [
					document.querySelector('[data-slot^="inventory:"]'),
				].filter((element): element is Element => element !== null);
			}
			if (x >= 400 && x < 480) {
				return [
					document.querySelector('[data-slot^="toolbar:"]'),
				].filter((element): element is Element => element !== null);
			}
			if (x >= 180 && x < 340) {
				return [
					document.querySelector('[data-surface="inventory"]'),
				].filter((element): element is Element => element !== null);
			}
			return [];
		}),
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const renderHarness = async () => {
	let currentSystem: TileSystem | null = null;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Harness, {
				onSystem: (system) => {
					currentSystem = system;
				},
			}),
		);
	});
	const readSystem = () => {
		if (currentSystem === null) throw new Error("Tile system was not captured.");
		return currentSystem;
	};
	return {
		readSystem,
	};
};

const startDrag = async (system: TileSystem, x: number, y: number) => {
	const result: {
		value: ReturnType<TileSystem["release"]>;
	} = {
		value: null,
	};
	await act(async () => {
		expect(system.press(source)).toBe(true);
		system.startDrag(source);
		system.moveDrag(source, x, y);
		result.value = system.release(source.id);
	});
	return result.value;
};

describe("TileSystemProvider", () => {
	it("rerenders only the dragged actor and exact previous/new targets at logical boundaries", async () => {
		const { readSystem } = await renderHarness();
		const initialActors = new Map(actorRenderCounts);
		const initialSlots = new Map(slotRenderCounts);
		const readActorRenders = (itemId: string) => actorRenderCounts.get(itemId) ?? 0;
		const readSlotRenders = (surface: TileSurface, slot: TileSlot) =>
			slotRenderCounts.get(`${surface.id}:${slot.id}`) ?? 0;

		await act(async () => {
			const system = readSystem();
			expect(system.press(source)).toBe(true);
			system.startDrag(source);
			system.moveDrag(source, 240, 50);
		});

		expect(readActorRenders(source.id)).toBeGreaterThan(initialActors.get(source.id) ?? 0);
		expect(readActorRenders(toolbarOccupant.id)).toBe(initialActors.get(toolbarOccupant.id));
		expect(readActorRenders("runtime:unrelated")).toBe(initialActors.get("runtime:unrelated"));
		expect(readSlotRenders(inventorySurface, inventorySlot)).toBe(
			(initialSlots.get(`${inventorySurface.id}:${inventorySlot.id}`) ?? 0) + 1,
		);
		expect(readSlotRenders(toolbarSurface, toolbarSlot)).toBe(
			initialSlots.get(`${toolbarSurface.id}:${toolbarSlot.id}`),
		);

		const insideTargetActors = new Map(actorRenderCounts);
		const insideTargetSlots = new Map(slotRenderCounts);
		await act(async () => {
			readSystem().moveDrag(source, 250, 60);
		});
		expect(actorRenderCounts).toEqual(insideTargetActors);
		expect(slotRenderCounts).toEqual(insideTargetSlots);

		await act(async () => {
			readSystem().moveDrag(source, 440, 50);
		});
		expect(readActorRenders(source.id)).toBe((insideTargetActors.get(source.id) ?? 0) + 1);
		expect(readActorRenders(toolbarOccupant.id)).toBe(
			(insideTargetActors.get(toolbarOccupant.id) ?? 0) + 1,
		);
		expect(readActorRenders("runtime:unrelated")).toBe(
			insideTargetActors.get("runtime:unrelated"),
		);
		expect(readSlotRenders(inventorySurface, inventorySlot)).toBe(
			(insideTargetSlots.get(`${inventorySurface.id}:${inventorySlot.id}`) ?? 0) + 1,
		);
		expect(readSlotRenders(toolbarSurface, toolbarSlot)).toBe(
			(insideTargetSlots.get(`${toolbarSurface.id}:${toolbarSlot.id}`) ?? 0) + 1,
		);
		expect(readSlotRenders(boardSurface, sourceSlot)).toBe(
			insideTargetSlots.get(`${boardSurface.id}:${sourceSlot.id}`),
		);
	});

	it("refreshes same-node occupant truth without publishing global geometry", async () => {
		const { readSystem } = await renderHarness();
		await act(async () => {
			const system = readSystem();
			expect(system.press(source)).toBe(true);
			system.startDrag(source);
			system.moveDrag(source, 440, 50);
		});
		expect(readSystem().active).toMatchObject({
			phase: "dragging",
			target: {
				kind: "slot",
				occupant: toolbarOccupant,
			},
		});

		const geometryVersion = readSystem().geometryVersion;
		const actorsBeforeRevision = new Map(actorRenderCounts);
		const slotsBeforeRevision = new Map(slotRenderCounts);
		previewState.observedRevisions.splice(0);
		await act(async () => {
			updateToolbarRevision?.("revision:toolbar-updated");
		});

		expect(readSystem().geometryVersion).toBe(geometryVersion);
		expect(readSystem().active).toMatchObject({
			phase: "dragging",
			target: {
				kind: "slot",
				occupant: {
					id: toolbarOccupant.id,
					revision: "revision:toolbar-updated",
				},
			},
		});
		expect(previewState.observedRevisions).toEqual([
			"revision:toolbar-updated",
		]);
		expect(actorRenderCounts.get(source.id)).toBe(
			(actorsBeforeRevision.get(source.id) ?? 0) + 1,
		);
		expect(actorRenderCounts.get(toolbarOccupant.id)).toBe(
			(actorsBeforeRevision.get(toolbarOccupant.id) ?? 0) + 1,
		);
		expect(actorRenderCounts.get("runtime:unrelated")).toBe(
			actorsBeforeRevision.get("runtime:unrelated"),
		);
		for (const [slotKey, renders] of slotsBeforeRevision) {
			if (slotKey === `${toolbarSurface.id}:${toolbarSlot.id}`) continue;
			expect(slotRenderCounts.get(slotKey), slotKey).toBe(renders);
		}
	});

	it("keeps the exact released target frozen while its command outcome is pending", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);
		if (released === null) throw new Error("Expected a released drag.");
		const geometryVersion = readSystem().geometryVersion;
		previewState.observedRevisions.splice(0);

		await act(async () => {
			updateToolbarRevision?.("revision:toolbar-after-release");
		});

		expect(readSystem().geometryVersion).toBe(geometryVersion);
		expect(readSystem().active).toMatchObject({
			phase: "awaiting-outcome",
			target: {
				kind: "slot",
				occupant: toolbarOccupant,
			},
		});
		expect(previewState.observedRevisions).toEqual([]);
	});

	it("assigns fractional shared seams and outer edges to exactly one Board slot", async () => {
		const { readSystem } = await renderHarness();

		const seam = await startDrag(readSystem(), 50.25, 49.75);
		expect(seam).toMatchObject({
			target: {
				kind: "slot",
				surface: boardSurface,
				slot: boardBottomRightSlot,
			},
		});
		await act(async () => {
			if (seam !== null) readSystem().completeDrop(seam.source, seam.generation);
		});

		const outerEdge = await startDrag(readSystem(), 100.5, 99.5);
		expect(outerEdge).toMatchObject({
			target: {
				kind: "slot",
				surface: boardSurface,
				slot: boardBottomRightSlot,
			},
		});
	});

	it("invalidates an active interaction generation on scene reset", async () => {
		const { readSystem } = await renderHarness();
		await act(async () => {
			const system = readSystem();
			expect(system.press(source)).toBe(true);
			system.startDrag(source);
			system.moveDrag(source, 240, 50);
		});
		expect(readSystem().active?.phase).toBe("dragging");

		await act(async () => readSystem().resetInteraction());

		expect(readSystem().active).toBeNull();
		expect(readSystem().release(source.id)).toBeNull();
	});

	it("reports a Board source dropped into one inventory slot", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 240, 50);

		expect(released).toMatchObject({
			target: {
				kind: "slot",
				surface: inventorySurface,
				slot: inventorySlot,
				occupant: null,
			},
		});
	});

	it("freezes the exact source facts captured at pointer press", async () => {
		const { readSystem } = await renderHarness();
		const system = readSystem();
		const changedSource = {
			...source,
			revision: "revision:changed",
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 9,
					y: 9,
				},
			},
		};

		let released: ReturnType<TileSystem["release"]> = null;
		await act(async () => {
			expect(system.press(source)).toBe(true);
			system.startDrag(changedSource);
			system.moveDrag(changedSource, 240, 50);
			released = system.release(source.id);
		});

		expect(released).toMatchObject({
			source,
		});
	});

	it("preserves an occupied toolbar target as a logical drop fact", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);

		expect(released).toMatchObject({
			target: {
				kind: "slot",
				surface: toolbarSurface,
				slot: toolbarSlot,
				occupant: toolbarOccupant,
			},
		});
	});

	it("publishes the authoritative combine preview only for a mergeable occupied target", async () => {
		previewState.occupiedKind = "merge";
		const { readSystem } = await renderHarness();
		await act(async () => {
			const system = readSystem();
			expect(system.press(source)).toBe(true);
			system.startDrag(source);
			system.moveDrag(source, 440, 50);
		});

		expect(readSystem().active).toMatchObject({
			phase: "dragging",
			previewKind: DropItemResultKindEnumSchema.enum.Merge,
		});
	});

	it("distinguishes a surface gap and an unrelated topmost overlay from a slot", async () => {
		const { readSystem } = await renderHarness();
		const gap = await startDrag(readSystem(), 300, 50);
		expect(gap).toMatchObject({
			target: {
				kind: "surface",
				surface: inventorySurface,
			},
		});
		await act(async () => {
			if (gap !== null) readSystem().completeDrop(gap.source, gap.generation);
		});

		const overlay = document.createElement("div");
		document.body.append(overlay);
		vi.mocked(document.elementsFromPoint).mockReturnValue([
			overlay,
		]);
		const blocked = await startDrag(readSystem(), 20, 20);
		expect(blocked).toMatchObject({
			target: {
				kind: "outside",
			},
		});
	});

	it("clears only the exact pending generation when the drop command completes", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 240, 50);
		if (released === null) throw new Error("Expected a released drag.");
		expect(readSystem().active?.phase).toBe("awaiting-outcome");

		await act(async () => {
			readSystem().completeDrop(released.source, released.generation - 1);
		});
		expect(readSystem().active?.phase).toBe("awaiting-outcome");

		await act(async () => {
			readSystem().completeDrop(released.source, released.generation);
		});
		expect(readSystem().active).toBeNull();
	});
});
