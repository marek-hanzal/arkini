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

const Capture = ({
	item = actor,
	live = false,
}: {
	readonly item?: useTileActors.Item;
	readonly live?: boolean;
}) => {
	captured = useTileActorPresentation({
		item,
		live,
	});
	return null;
};

const renderPresentation = async (item: useTileActors.Item = actor, live = false) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(Capture, {
				item,
				live,
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

describe("Tile actor presentation stack settlement", () => {
	const targetActor = {
		...actor,
		id: "runtime:target",
		revision: "revision:target-current",
		itemId: actor.itemId,
		title: "Target",
		quantity: 10,
		location: targetLocation,
	} satisfies useTileActors.Item;
	const sourceCurrent = {
		...actor,
		revision: "revision:source-current",
		quantity: 3,
	};
	const outcome = (current: typeof sourceCurrent | null) => ({
		kind: DropItemResultKindEnumSchema.enum.Stack,
		transferredQuantity: 2,
		source: {
			itemId: actor.id,
			canonicalItemId: actor.itemId,
			previousRevision: actor.revision,
			previousLocation: sourceLocation,
			previousQuantity: 5,
			current:
				current === null
					? null
					: {
							itemId: current.id,
							canonicalItemId: current.itemId,
							revision: current.revision,
							location: current.location,
							quantity: current.quantity,
						},
		},
		target: {
			itemId: targetActor.id,
			canonicalItemId: targetActor.itemId,
			previousRevision: "revision:target-previous",
			previousLocation: targetLocation,
			previousQuantity: 8,
			current: {
				itemId: targetActor.id,
				canonicalItemId: targetActor.itemId,
				revision: targetActor.revision,
				location: targetActor.location,
				quantity: targetActor.quantity,
			},
		},
	});

	it("holds both previous quantities while the source follows the exact target", async () => {
		interactionState.active = {
			source,
			generation: 7,
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Stack,
				stage: "approach",
				feedback: "accepted",
				pendingActorIds: [
					actor.id,
				],
				outcome: outcome(sourceCurrent),
			},
		};

		const sourcePresentation = await renderPresentation(sourceCurrent, true);
		const targetPresentation = await renderPresentation(targetActor, true);

		expect(sourcePresentation).toMatchObject({
			followTarget: {
				interactionGeneration: 7,
				stage: "approach",
				sourceItemId: actor.id,
				targetItemId: targetActor.id,
			},
			phase: "combining",
			quantityOverride: 5,
			positionCompletion: {
				kind: "always",
				generation: 7,
			},
		});
		expect(targetPresentation).toMatchObject({
			followTarget: null,
			phase: "combining",
			quantityOverride: 8,
		});
	});

	it("boomerangs a partial source and impacts the target with current quantities after contact", async () => {
		interactionState.active = {
			source,
			generation: 8,
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Stack,
				stage: "resolve",
				feedback: "accepted",
				pendingActorIds: [
					actor.id,
					targetActor.id,
				],
				outcome: outcome(sourceCurrent),
			},
		};

		const sourcePresentation = await renderPresentation(sourceCurrent, true);
		const targetPresentation = await renderPresentation(targetActor, true);

		expect(sourcePresentation).toMatchObject({
			followTarget: null,
			phase: "settling",
			quantityOverride: null,
			desiredSource: {
				location: sourceLocation,
			},
			positionCompletion: {
				kind: "location",
				generation: 8,
				location: sourceLocation,
			},
		});
		expect(targetPresentation).toMatchObject({
			followTarget: null,
			phase: "impact",
			quantityOverride: null,
			desiredSource: {
				location: targetLocation,
			},
			visualCompletionGeneration: 8,
		});
	});

	it("freezes a fully consumed source at the target for its exit", async () => {
		interactionState.active = {
			source,
			generation: 9,
			phase: "settling",
			settlement: {
				kind: DropItemResultKindEnumSchema.enum.Stack,
				stage: "resolve",
				feedback: "accepted",
				pendingActorIds: [
					actor.id,
					targetActor.id,
				],
				outcome: outcome(null),
			},
		};

		const presentation = await renderPresentation(actor);

		expect(presentation).toMatchObject({
			followTarget: null,
			phase: "exiting",
			placementFrozen: true,
			quantityOverride: null,
			desiredSource: {
				location: targetLocation,
			},
			visualCompletionGeneration: 9,
		});
	});
});
