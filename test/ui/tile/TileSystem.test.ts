// @vitest-environment jsdom

import { act, createElement, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemContext, type TileSystem } from "~/ui/tile/TileSystemContext";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";
import { useTileSlot } from "~/ui/tile/useTileSlot";
import { useTileSurface } from "~/ui/tile/useTileSurface";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

vi.mock("~/bridge/tile/useTileActors", () => ({
	useTileActors: () => [],
}));

const previewState = vi.hoisted(() => ({
	occupiedKind: "swap" as "swap" | "merge" | "store-input",
}));

vi.mock("~/bridge/tile/useDropItemPreview", () => ({
	useDropItemPreview: () =>
		(props: {
			readonly target:
				| { readonly kind: "unsupported" }
				| { readonly kind: "slot"; readonly occupant: object | null };
		}) => {
			if (props.target.kind === "unsupported") {
				return {
					kind: "reject" as const,
					reason: "unsupported-target" as const,
				};
			}
			return {
				kind:
					props.target.occupant === null
						? ("move" as const)
						: previewState.occupiedKind,
			};
		},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

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

const Capture = ({ onSystem }: { readonly onSystem: (system: TileSystem) => void }) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("Missing TileSystemProvider.");
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
		createElement(Surface, {
			surface: toolbarSurface,
			slots: [
				{
					slot: toolbarSlot,
					occupant: toolbarOccupant,
				},
			],
		}),
	);

beforeEach(() => {
	previewState.occupiedKind = "swap";
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
			if (seam !== null) readSystem().settle(seam.source, seam.generation, null);
			if (seam !== null) readSystem().complete(source.id, seam.generation);
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
			if (gap !== null) readSystem().settle(gap.source, gap.generation, null);
			if (gap !== null) readSystem().complete(source.id, gap.generation);
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

	it("keeps the rejected target snapshot without making its lifetime block settlement", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);
		if (released === null) throw new Error("Expected a released drag.");

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.Reject,
				reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
				itemId: source.id,
				targetItemId: toolbarOccupant.id,
			});
		});

		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Reject,
				target: {
					kind: "slot",
					occupant: toolbarOccupant,
				},
				pendingActorIds: [source.id],
			},
		});

		await act(async () => readSystem().complete(source.id, released.generation));
		expect(readSystem().active).toBeNull();
	});

	it("keeps one swap generation active until both actor settlements complete", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);
		if (released === null) throw new Error("Expected a released drag.");

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.Swap,
				source: {
					itemId: source.id,
					revision: "revision:source-swapped",
					previousLocation: source.location,
					location: {
						scope: "inventory",
						position: {
							x: toolbarSlot.x,
							y: toolbarSlot.y,
						},
					},
				},
				target: {
					itemId: toolbarOccupant.id,
					revision: "revision:target-swapped",
					previousLocation: {
						scope: "inventory",
						position: {
							x: toolbarSlot.x,
							y: toolbarSlot.y,
						},
					},
					location: source.location,
				},
			});
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Swap,
				pendingActorIds: [
					source.id,
					toolbarOccupant.id,
				],
			},
		});

		await act(async () => {
			readSystem().complete(source.id, released.generation);
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Swap,
				pendingActorIds: [
					toolbarOccupant.id,
				],
			},
		});

		await act(async () => {
			readSystem().complete(toolbarOccupant.id, released.generation);
		});
		expect(readSystem().active).toBeNull();
	});

	it("advances one input-store generation through approach and full source absorption", async () => {
		previewState.occupiedKind = "store-input";
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);
		if (released === null) throw new Error("Expected a released drag.");
		const targetLocation = {
			scope: "inventory" as const,
			position: {
				x: toolbarSlot.x,
				y: toolbarSlot.y,
			},
		};

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				storedQuantity: 1,
				lineId: "line:target",
				inputIndex: 0,
				source: {
					itemId: source.id,
					canonicalItemId: "item:source",
					previousRevision: source.revision,
					previousLocation: source.location,
					previousQuantity: 1,
					current: null,
				},
				owner: {
					itemId: toolbarOccupant.id,
					revision: toolbarOccupant.revision,
					location: targetLocation,
				},
			});
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				stage: "approach",
				pendingActorIds: [source.id],
			},
		});

		await act(async () => {
			readSystem().complete(source.id, released.generation);
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				stage: "resolve",
				pendingActorIds: [source.id, toolbarOccupant.id],
			},
		});

		await act(async () => {
			readSystem().complete(source.id, released.generation);
			readSystem().complete(toolbarOccupant.id, released.generation);
		});
		expect(readSystem().active).toBeNull();
	});

	it("advances one merge generation from approach into source and target resolution", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 440, 50);
		if (released === null) throw new Error("Expected a released drag.");
		const targetLocation = {
			scope: "inventory" as const,
			position: {
				x: toolbarSlot.x,
				y: toolbarSlot.y,
			},
		};

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				action: "consume",
				effect: "keep",
				source: {
					itemId: source.id,
					previousRevision: source.revision,
					previousLocation: source.location,
					previousQuantity: 1,
					current: null,
				},
				target: {
					itemId: toolbarOccupant.id,
					previousRevision: toolbarOccupant.revision,
					previousLocation: targetLocation,
					previousQuantity: 1,
					current: {
						itemId: toolbarOccupant.id,
						canonicalItemId: "item:target",
						revision: toolbarOccupant.revision,
						location: targetLocation,
						quantity: 1,
					},
				},
			});
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				stage: "approach",
				pendingActorIds: [
					source.id,
				],
			},
		});

		await act(async () => {
			readSystem().complete(source.id, released.generation);
		});
		expect(readSystem().active).toMatchObject({
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				stage: "resolve",
				pendingActorIds: [
					source.id,
					toolbarOccupant.id,
				],
			},
		});

		await act(async () => {
			readSystem().complete(source.id, released.generation);
			readSystem().complete(toolbarOccupant.id, released.generation);
		});
		expect(readSystem().active).toBeNull();
	});

	it("ignores stale completion generations and clears only the current settlement", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 240, 50);
		if (released === null) throw new Error("Expected a released drag.");

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: source.id,
				revision: "revision:moved",
				previousLocation: source.location,
				location: {
					scope: "inventory",
					position: {
						x: inventorySlot.x,
						y: inventorySlot.y,
					},
				},
			});
			readSystem().complete(source.id, released.generation - 1);
		});
		expect(readSystem().active?.phase).toBe("settling");

		await act(async () => {
			readSystem().complete(source.id, released.generation);
		});
		expect(readSystem().active).toBeNull();
	});

	it("unlocks a surviving actor at the authoritative outcome and ignores the interrupted settle completion", async () => {
		const { readSystem } = await renderHarness();
		const released = await startDrag(readSystem(), 240, 50);
		if (released === null) throw new Error("Expected a released drag.");
		const movedSource = {
			...source,
			revision: "revision:moved",
			location: {
				scope: "inventory" as const,
				position: {
					x: inventorySlot.x,
					y: inventorySlot.y,
				},
			},
			surface: inventorySurface,
			slot: inventorySlot,
		} satisfies TileDragSource;

		expect(readSystem().press(movedSource)).toBe(false);

		await act(async () => {
			readSystem().settle(released.source, released.generation, {
				kind: DropItemResultKindEnumSchema.enum.Move,
				itemId: source.id,
				revision: movedSource.revision,
				previousLocation: source.location,
				location: movedSource.location,
			});
			expect(readSystem().press(movedSource)).toBe(true);
			readSystem().complete(source.id, released.generation);
		});

		expect(readSystem().active).toMatchObject({
			phase: "pressed",
			source: movedSource,
		});
		expect(readSystem().active?.generation).toBeGreaterThan(released.generation);

		const chainedRelease: {
			value: ReturnType<TileSystem["release"]>;
		} = {
			value: null,
		};
		await act(async () => {
			readSystem().startDrag(movedSource);
			readSystem().moveDrag(movedSource, 440, 50);
			chainedRelease.value = readSystem().release(movedSource.id);
		});

		expect(chainedRelease.value).toMatchObject({
			source: movedSource,
			target: {
				kind: "slot",
				surface: toolbarSurface,
				slot: toolbarSlot,
			},
		});
		expect(chainedRelease.value?.generation).toBeGreaterThan(released.generation);
	});
});
