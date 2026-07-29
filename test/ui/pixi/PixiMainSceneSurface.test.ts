import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiGridDropFeedback } from "~/ui/pixi/grid/PixiGridDropFeedback";
import type { PixiApplicationOwner } from "~/ui/pixi/runtime/PixiApplicationOwner";
import { createPixiMainSceneSurfaceFx } from "~/ui/pixi/scene/createPixiMainSceneSurfaceFx";

interface FakeDisplayObject {
	readonly children: FakeDisplayObject[];
	readonly destroyCalls: number;
	readonly destroyed: boolean;
	addChild: (...children: FakeDisplayObject[]) => void;
	destroy: (options?: { readonly children?: boolean }) => void;
}

vi.mock("pixi.js", () => {
	class Container {
		readonly children: Container[] = [];
		destroyCalls = 0;
		destroyed = false;
		eventMode = "auto";
		hitArea: unknown = null;
		mask: Container | null = null;
		visible = true;

		addChild(...children: Container[]) {
			this.children.push(...children);
		}

		destroy(options?: { readonly children?: boolean }) {
			this.destroyCalls += 1;
			if (this.destroyed) return;
			this.destroyed = true;
			if (options?.children === true) {
				for (const child of this.children) child.destroy(options);
			}
		}
	}

	class Graphics extends Container {
		clear() {
			return this;
		}

		fill(_value: unknown) {
			return this;
		}

		rect(_x: number, _y: number, _width: number, _height: number) {
			return this;
		}

		roundRect(_x: number, _y: number, _width: number, _height: number, _radius: number) {
			return this;
		}

		stroke(_value: unknown) {
			return this;
		}
	}

	class Rectangle {
		constructor(
			readonly x: number,
			readonly y: number,
			readonly width: number,
			readonly height: number,
		) {}
	}

	return {
		Container,
		Graphics,
		Rectangle,
	};
});

const palette = {
	accent: 0x00ff00,
	danger: 0xff0000,
	foreground: 0xffffff,
	gridA: 0x111111,
	gridB: 0x222222,
	line: 0x333333,
	overlay: 0x444444,
	overlayForeground: 0xffffff,
	success: 0x57d7b2,
	surface: 0x555555,
	toolbarA: 0x666666,
	toolbarB: 0x777777,
};

const game = {
	config: {
		meta: {
			board: {
				height: 7,
				width: 11,
			},
			toolbarSize: 8,
		},
	},
	getTransitionSnapshot: () => ({
		runtime: {
			currentSpace: 0,
		},
	}),
} as unknown as GameEngine;

const readTree = (root: FakeDisplayObject): readonly FakeDisplayObject[] => [
	root,
	...root.children.flatMap(readTree),
];

describe("Pixi main scene surface", () => {
	it("indexes every Board footprint cell while keeping hit and requested anchor distinct", () => {
		const stage = new Container() as unknown as FakeDisplayObject;
		const renderFeedback = vi.fn();
		const dropFeedback = {
			closeFx: Effect.void,
			container: new Container(),
			renderFx: (props) =>
				Effect.sync(() => {
					renderFeedback(props);
				}),
		} satisfies PixiGridDropFeedback;
		const application = {
			app: {
				screen: {
					height: 720,
					width: 1280,
				},
				stage,
			},
			frames: {
				invalidateFx: Effect.void,
			},
			stage,
		} as unknown as PixiApplicationOwner;
		const item = {
			activityEffect: false,
			footprint: {
				height: 2,
				width: 2,
			},
			id: "runtime:quarry",
			itemId: "quarry",
			itemType: "producer",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 3,
					y: 2,
				},
			},
			primaryAction: {
				kind: "none",
			},
			quantity: 1,
			revision: "revision:quarry",
			running: false,
			sourceUrl: "resource:quarry",
			title: "Quarry",
		} satisfies TileActorItem;
		const blocker = {
			...item,
			footprint: {
				height: 1,
				width: 1,
			},
			id: "runtime:blocker",
			itemId: "blocker",
			location: {
				...item.location,
				position: {
					x: 5,
					y: 3,
				},
			},
			revision: "revision:blocker",
			title: "Blocker",
		} satisfies TileActorItem;
		const canonicalItems = new Map([
			[
				item.id,
				item,
			],
			[
				blocker.id,
				blocker,
			],
		]);
		const readCanonicalItem = vi.fn((actorId: string) => canonicalItems.get(actorId));
		const surface = Effect.runSync(
			createPixiMainSceneSurfaceFx({
				application,
				dropFeedback,
				game,
				palette,
				readCanonicalItem,
				readCanonicalItems: () => canonicalItems.values(),
			}),
		);
		const target = {
			hitX: 4,
			hitY: 3,
			kind: "slot" as const,
			layout: {
				cellSize: 80,
				columns: 11,
				height: 560,
				kind: "board" as const,
				rows: 7,
				width: 880,
				x: 0,
				y: 0,
			},
			x: 6,
			y: 4,
		};

		expect(Effect.runSync(surface.readOccupantFx(target))).toBe(item);
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: 1,
					width: 1,
					x: target.layout.x + target.hitX * target.layout.cellSize,
					y: target.layout.y + target.hitY * target.layout.cellSize,
				}),
			),
		).toEqual(
			new Set([
				item.id,
			]),
		);
		expect(Effect.runSync(surface.readCommandTargetFx(target))).toMatchObject({
			hitLocation: {
				position: {
					x: 4,
					y: 3,
				},
			},
			location: {
				position: {
					x: 6,
					y: 4,
				},
			},
			occupant: {
				itemId: item.id,
				revision: item.revision,
			},
		});
		Effect.runSync(
			surface.renderDropFeedbackFx(target, {
				collisions: [
					{
						itemId: item.id,
						revision: item.revision,
					},
					{
						itemId: blocker.id,
						revision: blocker.revision,
					},
				],
				destinationFootprint: {
					height: 1,
					width: 3,
				},
				kind: "swap",
				targetLocation: item.location,
			}),
		);
		expect(
			(
				renderFeedback.mock.lastCall?.[0] as {
					readonly markers: ReadonlyArray<unknown>;
				}
			).markers,
		).toEqual([
			{
				color: palette.accent,
				slot: {
					height: 1,
					width: 3,
					x: 6,
					y: 4,
				},
			},
			{
				color: palette.danger,
				slot: {
					x: 5,
					y: 3,
				},
			},
			{
				color: palette.foreground,
				slot: {
					x: 4,
					y: 3,
				},
			},
		]);

		readCanonicalItem.mockClear();
		Effect.runSync(
			surface.refreshOccupancyFx(
				new Set([
					"runtime:unrelated",
				]),
			),
		);
		expect(readCanonicalItem).toHaveBeenCalledOnce();
		expect(readCanonicalItem).toHaveBeenCalledWith("runtime:unrelated");
		expect(Effect.runSync(surface.readOccupantFx(target))).toBe(item);
	});

	it("destroys its owned display tree without closing borrowed drop feedback", () => {
		const stage = new Container() as unknown as FakeDisplayObject;
		const dropFeedbackContainer = new Container();
		const dropFeedbackDisplayObject = dropFeedbackContainer as unknown as FakeDisplayObject;
		const dropFeedback = {
			closeFx: Effect.void,
			container: dropFeedbackContainer,
			renderFx: () => Effect.void,
		} satisfies PixiGridDropFeedback;
		const application = {
			app: {
				screen: {
					height: 720,
					width: 1280,
				},
				stage,
			},
			frames: {
				invalidateFx: Effect.void,
			},
			stage,
		} as unknown as PixiApplicationOwner;
		const surface = Effect.runSync(
			createPixiMainSceneSurfaceFx({
				application,
				dropFeedback,
				game,
				palette,
				readCanonicalItem: () => undefined,
				readCanonicalItems: () => [],
			}),
		);
		const owned = stage.children.flatMap(readTree);

		Effect.runSync(surface.closeFx);
		Effect.runSync(surface.closeFx);

		expect(owned).toHaveLength(9);
		for (const displayObject of owned) {
			if (displayObject === dropFeedbackDisplayObject) {
				expect(displayObject.destroyed).toBe(false);
				expect(displayObject.destroyCalls).toBe(0);
				continue;
			}
			expect(displayObject.destroyed).toBe(true);
			expect(displayObject.destroyCalls).toBe(1);
		}
		expect(stage.destroyed).toBe(false);
	});
});
