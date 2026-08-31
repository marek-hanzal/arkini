import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { createMainActorStoreFx } from "~/tile-rendering/fx/createMainActorStoreFx";
import type { DropFeedback } from "~/game-scene/service/DropFeedback";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import { createMainSurfaceFx } from "~/game-scene/fx/createMainSurfaceFx";

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
	getTransitionSnapshotFn: () => ({
		runtime: {
			currentSpace: 0,
		},
	}),
} as unknown as GameEngine;

const readTree = (root: FakeDisplayObject): readonly FakeDisplayObject[] => [
	root,
	...root.children.flatMap(readTree),
];

const item = (
	id: string,
	location: TileActorItem["location"],
	revision = `revision:${id}:1`,
): TileActorItem => ({
	activityEffect: false,
	id,
	itemId: id,
	itemType: "simple",
	location,
	primaryAction: {
		kind: "none",
	},
	quantity: 1,
	revision,
	running: false,
	sourceUrl: `resource:${id}`,
	title: id,
});

describe("main surface", () => {
	it("reads coherent target facts and deterministic grid-local candidates from canonical occupancy", () => {
		const actorStore = Effect.runSync(createMainActorStoreFx());
		const boardFirst = item("runtime:board-first", {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		});
		const boardSecond = item("runtime:board-second", {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 0,
			},
		});
		const boardFar = item("runtime:board-far", {
			scope: "board",
			space: 0,
			position: {
				x: 8,
				y: 4,
			},
		});
		const toolbarItem = item("runtime:toolbar", {
			scope: "toolbar",
			position: {
				x: 3,
				y: 0,
			},
		});
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				boardSecond,
				boardFar,
				toolbarItem,
				boardFirst,
			]),
		);
		const stage = new Container();
		const screen = {
			height: 720,
			width: 1280,
		};
		const application = {
			app: {
				screen,
				stage,
			},
			frames: {
				invalidateFx: Effect.void,
			},
			stage,
		} as unknown as PixiApplicationOwner;
		const surface = Effect.runSync(
			createMainSurfaceFx({
				actorStore,
				application,
				dropFeedback: {
					closeFx: Effect.void,
					container: new Container(),
					renderFx: () => Effect.void,
				},
				game,
				palette,
			}),
		);
		const firstPose = Effect.runSync(surface.readActorPoseFx(boardFirst));
		if (firstPose === null) throw new Error("Expected Board pose.");

		const firstFacts = Effect.runSync(
			surface.readTargetFactsFx(
				firstPose.x + firstPose.size / 2,
				firstPose.y + firstPose.size / 2,
			),
		);
		expect(firstFacts).toMatchObject({
			commandTarget: {
				kind: "slot",
				occupant: {
					itemId: boardFirst.id,
					revision: boardFirst.revision,
				},
			},
			occupant: boardFirst,
			target: {
				x: 1,
				y: 0,
			},
		});

		const revisedFirst = {
			...boardFirst,
			quantity: 3,
			revision: "revision:board-first:2",
		};
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				boardSecond,
				boardFar,
				toolbarItem,
				revisedFirst,
			]),
		);
		const revisedFacts = Effect.runSync(
			surface.readTargetFactsFx(
				firstPose.x + firstPose.size / 2,
				firstPose.y + firstPose.size / 2,
			),
		);
		expect(revisedFacts.occupant).toBe(revisedFirst);
		expect(revisedFacts.stableKey).not.toBe(firstFacts.stableKey);

		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: firstPose.size,
					width: firstPose.size * 2,
					x: firstPose.x,
					y: firstPose.y,
				}),
			),
		).toEqual([
			boardFirst.id,
			boardSecond.id,
		]);
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					excludeActorId: boardSecond.id,
					height: firstPose.size,
					width: firstPose.size,
					x: firstPose.x + firstPose.size,
					y: firstPose.y,
				}),
			),
		).toEqual([]);
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: firstPose.size,
					width: 0.0004,
					x: firstPose.x + firstPose.size - 0.001,
					y: firstPose.y,
				}),
			),
		).toEqual([
			boardFirst.id,
		]);
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: firstPose.size,
					width: 0.0005,
					x: firstPose.x - firstPose.size - 0.001,
					y: firstPose.y,
				}),
			),
		).toEqual([]);
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: 10,
					width: 10,
					x: 0,
					y: 0,
				}),
			),
		).toEqual([]);

		const toolbarPose = Effect.runSync(surface.readActorPoseFx(toolbarItem));
		if (toolbarPose === null) throw new Error("Expected Toolbar pose.");
		expect(
			Effect.runSync(
				surface.readLocalActorIdsFx({
					height: toolbarPose.size,
					width: toolbarPose.size,
					x: toolbarPose.x,
					y: toolbarPose.y,
				}),
			),
		).toEqual([
			toolbarItem.id,
		]);

		screen.width = 900;
		screen.height = 600;
		Effect.runSync(surface.redrawFx);
		const resizedPose = Effect.runSync(surface.readActorPoseFx(revisedFirst));
		if (resizedPose === null) throw new Error("Expected resized Board pose.");
		const resizedFacts = Effect.runSync(
			surface.readTargetFactsFx(
				resizedPose.x + resizedPose.size / 2,
				resizedPose.y + resizedPose.size / 2,
			),
		);
		expect(resizedFacts.occupant).toBe(revisedFirst);
		expect(resizedFacts.stableKey).not.toBe(revisedFacts.stableKey);

		const nextSpaceItem = item("runtime:next-space", {
			scope: "board",
			space: 1,
			position: {
				x: 1,
				y: 0,
			},
		});
		Effect.runSync(
			surface.setTransitionFx({
				runtime: {
					currentSpace: 1,
				},
			} as ReturnType<GameEngine["getTransitionSnapshotFn"]>),
		);
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				nextSpaceItem,
			]),
		);
		expect(
			Effect.runSync(
				surface.readTargetFactsFx(
					resizedPose.x + resizedPose.size / 2,
					resizedPose.y + resizedPose.size / 2,
				),
			).occupant,
		).toBe(nextSpaceItem);
	});

	it("destroys its owned display tree without closing borrowed drop feedback", () => {
		const stage = new Container() as unknown as FakeDisplayObject;
		const dropFeedbackContainer = new Container();
		const dropFeedbackDisplayObject = dropFeedbackContainer as unknown as FakeDisplayObject;
		const dropFeedback = {
			closeFx: Effect.void,
			container: dropFeedbackContainer,
			renderFx: () => Effect.void,
		} satisfies DropFeedback;
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
			createMainSurfaceFx({
				actorStore: Effect.runSync(createMainActorStoreFx()),
				application,
				dropFeedback,
				game,
				palette,
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
