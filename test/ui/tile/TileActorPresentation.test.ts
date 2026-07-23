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

const roots: Array<ReturnType<typeof createRoot>> = [];
let captured: useTileActorPresentation.Model | null = null;

const sourceLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 0,
		y: 0,
	},
};

const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
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

const Capture = () => {
	captured = useTileActorPresentation({
		item: actor,
		live: false,
	});
	return null;
};

const renderPresentation = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(createElement(Capture));
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

describe("Tile actor presentation live targets", () => {
	it("follows the exact input owner during StoreInput approach", async () => {
		interactionState.active = {
			source,
			generation: 4,
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				stage: "approach",
				feedback: "accepted",
				pendingActorIds: [
					actor.id,
				],
				outcome: {
					kind: DropItemResultKindEnumSchema.enum.StoreInput,
					storedQuantity: 1,
					lineId: "line:target",
					inputIndex: 0,
					source: {
						itemId: actor.id,
						canonicalItemId: actor.itemId,
						previousRevision: actor.revision,
						previousLocation: sourceLocation,
						previousQuantity: 1,
						current: null,
					},
					owner: {
						itemId: "runtime:owner",
						revision: "revision:owner",
						location: targetLocation,
					},
				},
			},
		};

		const presentation = await renderPresentation();

		expect(presentation.followTarget).toEqual({
			interactionGeneration: 4,
			stage: "approach",
			sourceItemId: actor.id,
			targetItemId: "runtime:owner",
		});
	});

	it("prefers the exact current replacement identity during Merge approach", async () => {
		interactionState.active = {
			source,
			generation: 5,
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Merge,
				stage: "approach",
				feedback: "accepted",
				pendingActorIds: [
					actor.id,
				],
				outcome: {
					kind: DropItemResultKindEnumSchema.enum.Merge,
					action: "consume",
					effect: "replace",
					resultCanonicalItemId: "item:replacement",
					source: {
						itemId: actor.id,
						previousRevision: actor.revision,
						previousLocation: sourceLocation,
						previousQuantity: 1,
						current: null,
					},
					target: {
						itemId: "runtime:previous-target",
						previousRevision: "revision:previous-target",
						previousLocation: targetLocation,
						previousQuantity: 1,
						current: {
							itemId: "runtime:replacement",
							canonicalItemId: "item:replacement",
							revision: "revision:replacement",
							location: targetLocation,
							quantity: 1,
						},
					},
				},
			},
		};

		const presentation = await renderPresentation();

		expect(presentation.followTarget?.targetItemId).toBe("runtime:replacement");
	});

	it.each([
		DropItemResultKindEnumSchema.enum.StoreInput,
		DropItemResultKindEnumSchema.enum.Merge,
	])("freezes a consumed source at contact during %s resolve", async (kind) => {
		const sourceOutcome = {
			itemId: actor.id,
			previousRevision: actor.revision,
			previousLocation: sourceLocation,
			previousQuantity: 1,
			current: null,
		};
		interactionState.active =
			kind === DropItemResultKindEnumSchema.enum.StoreInput
				? {
						source,
						generation: 6,
						phase: "settling",
						settlement: {
							kind,
							stage: "resolve",
							feedback: "accepted",
							pendingActorIds: [
								actor.id,
							],
							outcome: {
								kind,
								storedQuantity: 1,
								lineId: "line:target",
								inputIndex: 0,
								source: {
									...sourceOutcome,
									canonicalItemId: actor.itemId,
								},
								owner: {
									itemId: "runtime:owner",
									revision: "revision:owner",
									location: targetLocation,
								},
							},
						},
					}
				: {
						source,
						generation: 6,
						phase: "settling",
						settlement: {
							kind,
							stage: "resolve",
							feedback: "accepted",
							pendingActorIds: [
								actor.id,
							],
							outcome: {
								kind,
								action: "consume",
								effect: "keep",
								source: sourceOutcome,
								target: {
									itemId: "runtime:target",
									previousRevision: "revision:target",
									previousLocation: targetLocation,
									previousQuantity: 1,
									current: {
										itemId: "runtime:target",
										canonicalItemId: "item:target",
										revision: "revision:target",
										location: targetLocation,
										quantity: 1,
									},
								},
							},
						},
					};

		const presentation = await renderPresentation();

		expect(presentation.followTarget).toBeNull();
		expect(presentation.phase).toBe("exiting");
		expect(presentation.placementFrozen).toBe(true);
	});
});
