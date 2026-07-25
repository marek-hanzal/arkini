import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiActorAnimatorFx } from "~/ui/pixi/animation/createPixiActorAnimatorFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

const motionState = vi.hoisted(() => ({
	onComplete: null as (() => void) | null,
	onUpdate: null as ((progress: number) => void) | null,
}));

vi.mock("motion/react", () => ({
	animate: (
		_from: number,
		_to: number,
		options: {
			readonly onComplete: () => void;
			readonly onUpdate: (progress: number) => void;
		},
	) => {
		motionState.onComplete = options.onComplete;
		motionState.onUpdate = options.onUpdate;
		return {
			stop: vi.fn(),
		};
	},
}));

const createActor = () =>
	({
		container: {
			alpha: 0.82,
			destroyed: false,
			scale: {
				set(value: number) {
					this.x = value;
				},
				x: 0.75,
			},
			x: 10,
			y: 20,
		},
		item: {
			id: "runtime:actor",
		},
	}) as unknown as PixiTileActor;

const frames = {
	invalidateFx: Effect.void,
} as unknown as DemandFrameLoop;

describe("Pixi actor animator", () => {
	it("leaves unspecified alpha and scale channels untouched", () => {
		const actor = createActor();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				frames,
			}),
		);

		Effect.runSync(
			animator.animateFx({
				actor,
				durationMs: 300,
				toX: 100,
				toY: 200,
			}),
		);
		motionState.onUpdate?.(1);

		expect(actor.container.x).toBe(100);
		expect(actor.container.y).toBe(200);
		expect(actor.container.alpha).toBe(0.82);
		expect(actor.container.scale.x).toBe(0.75);
	});

	it("animates explicitly owned alpha and scale channels", () => {
		const actor = createActor();
		const animator = Effect.runSync(
			createPixiActorAnimatorFx({
				frames,
			}),
		);

		Effect.runSync(
			animator.animateFx({
				actor,
				durationMs: 300,
				toAlpha: 1,
				toScale: 1,
				toX: 100,
				toY: 200,
			}),
		);
		motionState.onUpdate?.(1);

		expect(actor.container.alpha).toBe(1);
		expect(actor.container.scale.x).toBe(1);
	});
});
