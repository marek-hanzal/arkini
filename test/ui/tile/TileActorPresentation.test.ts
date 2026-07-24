// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const interactionState = vi.hoisted(() => ({
	active: null as TileInteractionState | null,
}));

vi.mock("~/ui/tile/useTileActorInteraction", () => ({
	useTileActorInteraction: () => interactionState.active,
}));

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const actor: useTileActors.Item = {
	id: "runtime:source",
	revision: "revision:source",
	itemId: "item:source",
	title: "Source",
	quantity: 1,
	sourceUrl: "arkini://source",
	location: sourceLocation,
	running: false,
	primaryAction: {
		kind: "none",
	},
};

const source = {
	id: actor.id,
	revision: actor.revision,
	location: sourceLocation,
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

const roots: Array<ReturnType<typeof createRoot>> = [];
let captured: useTileActorPresentation.Model | null = null;

const Capture = ({ item }: { readonly item: useTileActors.Item }) => {
	captured = useTileActorPresentation({
		item,
	});
	return null;
};

const renderPresentation = async (item: useTileActors.Item = actor) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Capture, {
				item,
			}),
		);
	});
	if (captured === null) throw new Error("Presentation was not captured.");
	return captured;
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	interactionState.active = null;
	captured = null;
	document.body.replaceChildren();
});

describe("Tile actor immediate presentation", () => {
	it("projects a stable actor directly from its canonical live location", async () => {
		const presentation = await renderPresentation();

		expect(presentation.phase).toBe("stable");
		expect(presentation.canonicalSource).toEqual(source);
		expect(presentation.feedback).toBeNull();
	});

	it("projects accepted drag feedback without a post-drop phase", async () => {
		interactionState.active = {
			source,
			generation: 1,
			phase: "dragging",
			target: {
				kind: "slot",
				surface: source.surface,
				slot: {
					id: "1:0",
					x: 1,
					y: 0,
				},
				occupant: null,
			},
			previewKind: DropItemResultKindEnumSchema.enum.Move,
		};

		const presentation = await renderPresentation();

		expect(presentation.phase).toBe("dragging");
		expect(presentation.feedback).toBe("accepted");
		expect(presentation.forbiddenDrop).toBe(false);
	});

	it("projects a targeted actor with truthful rejected feedback", async () => {
		const target = {
			...actor,
			id: "runtime:target",
			revision: "revision:target",
			title: "Target",
			location: {
				...sourceLocation,
				position: {
					x: 1,
					y: 0,
				},
			},
		};
		interactionState.active = {
			source,
			generation: 2,
			phase: "dragging",
			target: {
				kind: "slot",
				surface: source.surface,
				slot: {
					id: "1:0",
					x: 1,
					y: 0,
				},
				occupant: {
					id: target.id,
					revision: target.revision,
				},
			},
			previewKind: DropItemResultKindEnumSchema.enum.Reject,
		};

		const presentation = await renderPresentation(target);

		expect(presentation.phase).toBe("targeted");
		expect(presentation.feedback).toBe("rejected");
	});
});
