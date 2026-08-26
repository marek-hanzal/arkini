import { Effect } from "effect";
import { vi } from "vitest";

import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type {
	PixiAnimationDriver,
	PixiAnimationSpring,
} from "~/ui/pixi/animation/PixiAnimationDriver";

export const createMagneticActor = (id: string, slotX: number) =>
	({
		container: {
			destroyed: false,
			pivot: {
				x: 0,
				y: 0,
			},
			scale: {
				x: 1,
				y: 1,
			},
			x: slotX * 80,
			y: 0,
		},
		instanceId: `pixi:${id}`,
		item: {
			id,
			location: {
				position: {
					x: slotX,
					y: 0,
				},
				scope: "board",
				space: 0,
			},
		},
		offsetLayer: {
			position: {
				set: vi.fn(),
			},
			x: 0,
			y: 0,
		},
		size: 80,
	}) as unknown as PixiTileActor;

export const createSpringAnimationDriverProbe = () => {
	const springs: Array<{
		readonly close: ReturnType<typeof vi.fn>;
		readonly setTarget: ReturnType<typeof vi.fn>;
	}> = [];
	const animationDriver = {
		closeFx: Effect.void,
		createSpringFx: () =>
			Effect.sync(() => {
				const close = vi.fn();
				const setTarget = vi.fn();
				springs.push({ close, setTarget });
				return {
					closeFx: Effect.sync(close),
					setTargetFx: (value) => Effect.sync(() => setTarget(value)),
				} satisfies PixiAnimationSpring;
			}),
		startTweenFx: () =>
			Effect.succeed({
				stopFx: Effect.void,
			}),
	} satisfies PixiAnimationDriver;
	return {
		animationDriver,
		springs,
	};
};
