// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
	TileInteractionContext,
	type TileInteractionSubscription,
} from "~/ui/tile/TileInteractionContext";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { useTileActorInteraction } from "~/ui/tile/useTileActorInteraction";
import { useTileSlotInteraction } from "~/ui/tile/useTileSlotInteraction";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const actorRenders = new Map<string, number>();
const slotRenders = new Map<string, number>();

const source = {
	id: "runtime:source",
	revision: "revision:source",
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	surface: {
		id: "board:0",
		kind: "board" as const,
		space: 0,
	},
	slot: {
		id: "0:0",
		x: 0,
		y: 0,
	},
};

const target = (slotId: string, itemId: string) => ({
	kind: "slot" as const,
	surface: source.surface,
	slot: {
		id: slotId,
		x: Number(slotId),
		y: 0,
	},
	occupant: {
		id: itemId,
		revision: `revision:${itemId}`,
	},
});

const activeAt = (generation: number, slotId: string, itemId: string) =>
	({
		phase: "dragging",
		generation,
		source,
		target: target(slotId, itemId),
		previewKind: "swap",
	}) satisfies TileInteractionState;

const createInteractionStore = () => {
	let active: TileInteractionState | null = null;
	const listeners = new Set<() => void>();
	const subscription = {
		readActive: () => active,
		subscribeActive: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	} satisfies TileInteractionSubscription;
	return {
		subscription,
		publish: (next: TileInteractionState | null) => {
			active = next;
			for (const listener of listeners) listener();
		},
		notifyPointerFrame: () => {
			for (const listener of listeners) listener();
		},
	};
};

const ActorCapture = ({ itemId }: { readonly itemId: string }) => {
	useTileActorInteraction(itemId);
	actorRenders.set(itemId, (actorRenders.get(itemId) ?? 0) + 1);
	return null;
};

const SlotCapture = ({
	surfaceId,
	slotId,
}: {
	readonly surfaceId: string;
	readonly slotId: string;
}) => {
	useTileSlotInteraction(surfaceId, slotId);
	const key = `${surfaceId}:${slotId}`;
	slotRenders.set(key, (slotRenders.get(key) ?? 0) + 1);
	return null;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	actorRenders.clear();
	slotRenders.clear();
	document.body.replaceChildren();
});

describe("Tile interaction render boundary", () => {
	it("selects source, previous target, and next target out of forty actors and slots", async () => {
		const store = createInteractionStore();
		const actorIds = [
			source.id,
			"runtime:target-a",
			"runtime:target-b",
			...Array.from(
				{
					length: 37,
				},
				(_, index) => `runtime:unrelated-${index}`,
			),
		];
		const slotIds = [
			"1",
			"2",
			...Array.from(
				{
					length: 38,
				},
				(_, index) => `unrelated-${index}`,
			),
		];
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					TileInteractionContext.Provider,
					{
						value: store.subscription,
					},
					...actorIds.map((itemId) =>
						createElement(ActorCapture, {
							key: itemId,
							itemId,
						}),
					),
					...slotIds.map((slotId) =>
						createElement(SlotCapture, {
							key: slotId,
							surfaceId: source.surface.id,
							slotId,
						}),
					),
				),
			);
		});
		const initialActors = new Map(actorRenders);
		const initialSlots = new Map(slotRenders);

		await act(async () => {
			store.publish(activeAt(1, "1", "runtime:target-a"));
		});
		expect(actorRenders.get(source.id)).toBe((initialActors.get(source.id) ?? 0) + 1);
		expect(actorRenders.get("runtime:target-a")).toBe(
			(initialActors.get("runtime:target-a") ?? 0) + 1,
		);
		expect(actorRenders.get("runtime:target-b")).toBe(initialActors.get("runtime:target-b"));
		expect(slotRenders.get("board:0:1")).toBe((initialSlots.get("board:0:1") ?? 0) + 1);
		expect(slotRenders.get("board:0:2")).toBe(initialSlots.get("board:0:2"));

		const insideActors = new Map(actorRenders);
		const insideSlots = new Map(slotRenders);
		await act(async () => {
			store.notifyPointerFrame();
		});
		expect(actorRenders).toEqual(insideActors);
		expect(slotRenders).toEqual(insideSlots);

		await act(async () => {
			store.publish(activeAt(1, "2", "runtime:target-b"));
		});
		expect(actorRenders.get(source.id)).toBe((insideActors.get(source.id) ?? 0) + 1);
		expect(actorRenders.get("runtime:target-a")).toBe(
			(insideActors.get("runtime:target-a") ?? 0) + 1,
		);
		expect(actorRenders.get("runtime:target-b")).toBe(
			(insideActors.get("runtime:target-b") ?? 0) + 1,
		);
		expect(slotRenders.get("board:0:1")).toBe((insideSlots.get("board:0:1") ?? 0) + 1);
		expect(slotRenders.get("board:0:2")).toBe((insideSlots.get("board:0:2") ?? 0) + 1);
		for (const itemId of actorIds.slice(3)) {
			expect(actorRenders.get(itemId), itemId).toBe(insideActors.get(itemId));
		}
		for (const slotId of slotIds.slice(2)) {
			const key = `${source.surface.id}:${slotId}`;
			expect(slotRenders.get(key), key).toBe(insideSlots.get(key));
		}
	});
});
