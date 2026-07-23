// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import { TileActorContent } from "~/ui/tile/TileActorContent";

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const item = (id: string, quantity: number): useTileActors.Item => ({
	id,
	revision: `revision:${id}`,
	itemId: "item:shared",
	title: id,
	quantity,
	sourceUrl: `arkini://${id}`,
	location: {
		scope: "board",
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	running: false,
	primaryAction: {
		kind: "none",
	},
});

const content = (
	current: useTileActors.Item,
	quantityOverride: number | null,
	phase: TileActorPhaseSchema.Type,
) =>
	createElement(TileActorContent, {
		item: current,
		quantityOverride,
		registerActorNode: () => undefined,
		surfaceId: "board:0",
		live: true,
		exiting: false,
		phase,
		feedback: "accepted",
		forbiddenDrop: false,
		cue: null,
		cueOriginOffset: null,
		cueTargetOffset: null,
		spawnDeliveryTiming: null,
		spawnDeliveryReady: true,
		onCueStart: () => undefined,
		onCueComplete: () => undefined,
	});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("Tile actor stack quantities", () => {
	it.each([
		{
			name: "partial source",
			current: item("runtime:source", 3),
			previousQuantity: 5,
			resolvePhase: "settling" as const,
		},
		{
			name: "target",
			current: item("runtime:target", 10),
			previousQuantity: 8,
			resolvePhase: "impact" as const,
		},
	])("keeps the $name quantity stable until contact and reveals the canonical result after it", async ({
		current,
		previousQuantity,
		resolvePhase,
	}) => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(content(current, previousQuantity, "combining"));
		});
		expect(
			container.querySelector<HTMLElement>('[data-ui="TileActorFace"]')?.dataset.tileQuantity,
		).toBe(String(previousQuantity));

		await act(async () => {
			root.render(content(current, null, resolvePhase));
		});
		expect(
			container.querySelector<HTMLElement>('[data-ui="TileActorFace"]')?.dataset.tileQuantity,
		).toBe(String(current.quantity));
	});
});
