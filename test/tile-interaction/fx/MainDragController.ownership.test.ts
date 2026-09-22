import { describe, expect, it } from "vitest";

import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import {
	createItem,
	flushMicrotasks,
	item,
	mountController,
	releaseOrdinaryDrag,
	setStackTarget,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: ownership", () => {
	it("does not let a stale drop callback touch a replacement actor instance", async () => {
		const target = createItem("runtime:target", 1);
		const mounted = mountController({
			targetItems: [
				target,
			],
		});
		setStackTarget(mounted, target);
		let resolveDrop!: (result: DropItemResult) => void;
		mounted.onDrop.mockReturnValueOnce(
			new Promise<DropItemResult>((resolve) => {
				resolveDrop = resolve;
			}) as never,
		);

		releaseOrdinaryDrag(mounted);
		const replacement = {
			...mounted.actor,
			dragging: true,
			instanceId: "test:replacement",
		} satisfies PixiTileActor;
		mounted.actors.set(item.id, replacement);
		resolveDrop({
			kind: "reject",
		} as DropItemResult);
		await flushMicrotasks();

		expect(replacement.dragging).toBe(true);
		expect(mounted.animations.some((animation) => animation.actor === replacement)).toBe(false);
		expect(
			mounted.animations.some(
				(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 1,
			),
		).toBe(false);
	});
});
