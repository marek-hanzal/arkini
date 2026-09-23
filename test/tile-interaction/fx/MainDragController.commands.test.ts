import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { DropItemResult } from "~/item-interaction/type/DropItemResult";

import {
	item,
	flushMicrotasks,
	mountController,
	releaseOrdinaryDrag,
	samplePoseAnimation,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: commands", () => {
	it("submits on pointer release and retains the exact pending actor until resolution", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		releaseOrdinaryDrag(mounted);

		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.isPendingActorFx(item.id))).toBe(true);
	});

	it("starts a surviving use-merge source returning before replaying the committed board", async () => {
		const mounted = mountController();
		const source = {
			itemId: item.id,
			previousRevision: item.revision,
			previousLocation: item.location,
			current: {
				itemId: item.id,
				itemUid: item.itemUid,
				revision: item.revision,
				location: item.location,
			},
		};
		const result: DropItemResult = {
			kind: "merge",
			action: "use",
			effect: "keep",
			source,
			target: {
				...source,
				itemId: "runtime:target",
				current: {
					...source.current,
					itemId: "runtime:target",
				},
			},
		};
		mounted.onDrop.mockResolvedValueOnce(result as never);
		mounted.onSettledDrop.mockImplementationOnce(() => {
			expect(mounted.animations.some((animation) => animation.channel === "pose")).toBe(true);
		});
		releaseOrdinaryDrag(mounted);
		const releasedX = mounted.actor.container.x;
		await flushMicrotasks();

		expect(mounted.reportCriticalFailureFn).not.toHaveBeenCalled();
		expect(mounted.actor.container.x).toBe(releasedX);
		const returning = mounted.animations.find((animation) => animation.channel === "pose");
		if (returning === undefined) throw new Error("Expected the used item to fly home.");
		expect(samplePoseAnimation(returning, 0).x).toBe(releasedX);
		const halfway = samplePoseAnimation(returning, 0.5);
		expect(halfway.x).toBeGreaterThan(10);
		expect(halfway.x).toBeLessThan(releasedX);
		expect(mounted.settleOriginGhost).not.toHaveBeenCalled();
		expect(samplePoseAnimation(returning, 1)).toMatchObject({
			x: 10,
			y: 20,
		});
		returning.onCompleteFn?.();
		expect(mounted.settleOriginGhost).toHaveBeenCalledOnce();
		expect(mounted.onSettledDrop).toHaveBeenCalledOnce();
		expect(mounted.onRejectedDrop).not.toHaveBeenCalled();
	});
});
