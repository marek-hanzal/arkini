import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiAnimationDriver } from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiGridDropFeedbackFx } from "~/ui/pixi/grid/createPixiGridDropFeedbackFx";
import type { PixiGridSurfaceLayout } from "~/ui/pixi/layout/PixiSceneLayout";

const surface = {
	cellSize: 80,
	columns: 3,
	height: 240,
	kind: "board",
	rows: 3,
	width: 240,
	x: 10,
	y: 20,
} satisfies PixiGridSurfaceLayout;

describe("Pixi grid drop feedback", () => {
	it("crossfades between targets and fades the final marker out", () => {
		const tweens: Array<Parameters<PixiAnimationDriver["startTweenFx"]>[0]> = [];
		const stopped = vi.fn();
		const animationDriver = {
			closeFx: Effect.void,
			createSpringFx: () =>
				Effect.succeed({
					closeFx: Effect.void,
					setTargetFx: () => Effect.void,
				}),
			startTweenFx: (tween) =>
				Effect.sync(() => {
					tweens.push(tween);
					return {
						stopFx: Effect.sync(stopped),
					};
				}),
		} satisfies PixiAnimationDriver;
		const feedback = Effect.runSync(
			createPixiGridDropFeedbackFx({
				animationDriver,
				label: "TestDropFeedback",
			}),
		);

		Effect.runSync(
			feedback.renderFx({
				color: 0x8855ff,
				slot: {
					x: 0,
					y: 0,
				},
				surface,
			}),
		);

		expect(tweens).toHaveLength(1);
		expect(tweens[0]).toMatchObject({
			durationMs: 130,
			from: 0,
			to: 1,
		});
		tweens[0]?.onUpdate(1);
		tweens[0]?.onComplete?.();

		Effect.runSync(
			feedback.renderFx({
				color: 0x8855ff,
				slot: {
					x: 1,
					y: 0,
				},
				surface,
			}),
		);

		expect(tweens.slice(1)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					durationMs: 180,
					from: 1,
					to: 0,
				}),
				expect.objectContaining({
					durationMs: 130,
					from: 0,
					to: 1,
				}),
			]),
		);
		for (const tween of tweens.slice(1)) {
			tween.onUpdate(tween.to);
			tween.onComplete?.();
		}

		Effect.runSync(
			feedback.renderFx({
				color: 0x8855ff,
				slot: null,
				surface,
			}),
		);

		expect(tweens.at(-1)).toMatchObject({
			durationMs: 180,
			from: 1,
			to: 0,
		});
		Effect.runSync(feedback.closeFx);
		expect(feedback.container.destroyed).toBe(true);
	});
});
