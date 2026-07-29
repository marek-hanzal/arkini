import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { PixiAnimationDriver } from "~/ui/pixi/animation/PixiAnimationDriver";
import { createPixiGridDropFeedbackFx } from "~/ui/pixi/grid/createPixiGridDropFeedbackFx";
import { drawPixiGridDropFeedbackFx } from "~/ui/pixi/grid/drawPixiGridDropFeedbackFx";
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
	it("draws the requested rectangle below collisions and the explicit hit", () => {
		const draws: Array<{
			readonly color: number;
			readonly rect: readonly [
				number,
				number,
				number,
				number,
			];
		}> = [];
		let rect: readonly [
			number,
			number,
			number,
			number,
		] = [
			0,
			0,
			0,
			0,
		];
		const graphics = {
			clear: () => graphics,
			fill: ({ color }: { readonly color: number }) => {
				draws.push({
					color,
					rect,
				});
				return graphics;
			},
			rect: (x: number, y: number, width: number, height: number) => {
				rect = [
					x,
					y,
					width,
					height,
				];
				return graphics;
			},
			stroke: () => graphics,
		};

		Effect.runSync(
			drawPixiGridDropFeedbackFx({
				color: 0x00ff00,
				graphics: graphics as never,
				markers: [
					{
						color: 0x00ff00,
						slot: {
							height: 1,
							width: 3,
							x: 1,
							y: 1,
						},
					},
					{
						color: 0xff0000,
						slot: {
							x: 2,
							y: 1,
						},
					},
					{
						color: 0xffffff,
						slot: {
							x: 2,
							y: 1,
						},
					},
				],
				slot: {
					height: 1,
					width: 3,
					x: 1,
					y: 1,
				},
				surface: {
					...surface,
					columns: 5,
					height: 400,
					rows: 5,
					width: 400,
				},
			}),
		);

		expect(draws).toEqual([
			{
				color: 0x00ff00,
				rect: [
					90,
					100,
					240,
					80,
				],
			},
			{
				color: 0xff0000,
				rect: [
					170,
					100,
					80,
					80,
				],
			},
			{
				color: 0xffffff,
				rect: [
					170,
					100,
					80,
					80,
				],
			},
		]);
	});

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
