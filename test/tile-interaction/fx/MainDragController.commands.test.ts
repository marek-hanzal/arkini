import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import {
	createItem,
	flushMicrotasks,
	item,
	mountController,
	pointer,
	releaseOrdinaryDrag,
	setOrdinaryInventoryTarget,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

const targetLocation = {
	scope: "board" as const,
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
};

const storedSource = {
	canonicalItemId: item.itemId,
	current: null,
	itemId: item.id,
	previousLocation: item.location,
	previousQuantity: item.quantity,
	previousRevision: item.revision,
} as const;

const redirectCases = [
	{
		name: "hands a consumed input source to its physical line owner",
		result: {
			inputIndex: 0,
			kind: "store-input",
			lineId: "line:log",
			owner: {
				itemId: "runtime:lumberjack",
				location: targetLocation,
				revision: "revision:lumberjack:2",
			},
			source: storedSource,
			storedQuantity: 1,
		} satisfies DropItemResult,
		expected: [
			{
				sourceActorId: item.id,
				targetActorId: "runtime:lumberjack",
				targetLocation,
			},
		],
	},
	{
		name: "hands a consumed merge source to the surviving target identity",
		result: {
			action: "consume",
			effect: "replace",
			kind: "merge",
			resultCanonicalItemId: "double-tree",
			source: {
				itemId: item.id,
				current: null,
				previousLocation: item.location,
				previousQuantity: item.quantity,
				previousRevision: item.revision,
			},
			target: {
				current: {
					canonicalItemId: "double-tree",
					itemId: "runtime:tree",
					location: targetLocation,
					quantity: 1,
					revision: "revision:tree:2",
				},
				itemId: "runtime:tree",
				previousLocation: targetLocation,
				previousQuantity: 1,
				previousRevision: "revision:tree:1",
			},
		} satisfies DropItemResult,
		expected: [
			{
				sourceActorId: item.id,
				targetActorId: "runtime:tree",
				targetLocation,
			},
		],
	},
	{
		name: "keeps following the original runtime identity while a source remainder survives",
		result: {
			inputIndex: 0,
			kind: "store-input",
			lineId: "line:log",
			owner: {
				itemId: "runtime:lumberjack",
				location: targetLocation,
				revision: "revision:lumberjack:2",
			},
			source: {
				...storedSource,
				current: {
					canonicalItemId: item.itemId,
					itemId: item.id,
					location: item.location,
					quantity: 2,
					revision: "revision:log:2",
				},
				previousQuantity: 3,
			},
			storedQuantity: 1,
		} satisfies DropItemResult,
		expected: [],
	},
] as const;

describe("main drag controller: commands", () => {
	it.each(redirectCases)("$name", async ({ expected, result }) => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(Promise.resolve(result) as never);

		releaseOrdinaryDrag(mounted);
		await flushMicrotasks();

		expect(mounted.targetRedirects).toEqual(expected);
	});

	it("submits on pointer release and retains the exact pending actor until resolution", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		releaseOrdinaryDrag(mounted);

		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.readSnapshotFx).pendingActorIds).toEqual(
			new Set([
				item.id,
			]),
		);
	});

	it("rebases a held stack to its latest canonical revision before an Inventory release", () => {
		const inventory = {
			...createItem("runtime:inventory", 1),
			itemType: "inventory",
		} as TileActorItem;
		const mounted = mountController({
			targetItems: [
				inventory,
			],
		});
		setOrdinaryInventoryTarget(mounted, inventory);
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		const canonicalStack = {
			...item,
			quantity: 2,
			revision: "revision:log:incoming-stacked",
		} satisfies TileActorItem;
		mounted.canonicalItems.set(item.id, canonicalStack);
		mounted.setItem({
			...canonicalStack,
			// The incoming payload remains visually hidden until physical contact.
			quantity: 1,
		});
		mounted.stage.emit("pointerup", pointer(30, 20));

		expect(mounted.onDrop).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceItemId: item.id,
				sourceLocation: item.location,
				sourceRevision: canonicalStack.revision,
			}),
		);
		expect(
			mounted.animations.some(
				(animation) =>
					animation.actor === mounted.actor &&
					animation.channel === "lifecycle-opacity" &&
					animation.toAlpha === 0,
			),
		).toBe(true);
	});
});
