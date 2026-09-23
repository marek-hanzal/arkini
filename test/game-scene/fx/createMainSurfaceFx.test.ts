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
};

const game = {
	config: {
		start: {
			spaces: [
				{
					space: 1,
					templateUid: "small",
				},
			],
		},
		templates: [
			{
				uid: "wide",
				width: 4,
				height: 2,
			},
			{
				uid: "small",
				width: 2,
				height: 1,
			},
		],
		meta: {
			board: {
				height: 7,
				width: 11,
			},
		},
	},
	getTransitionSnapshotFn: () => ({
		runtime: {
			currentSpace: 0,
			templateUidBySpace: {},
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

	location,
	primaryAction: {
		kind: "none",
	},
	revision,
	running: false,
	artworkScale: 0.8,
	sourceUrl: `resource:${id}`,
});

describe("main surface", () => {
	it("reads coherent target facts from canonical occupancy across revision and layout changes", () => {
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
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				boardSecond,
				boardFar,
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
			revision: "revision:board-first:2",
		};
		Effect.runSync(
			actorStore.replaceCanonicalItemsFx([
				boardSecond,
				boardFar,
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
					templateUidBySpace: {
						1: "small",
					},
				},
			} as unknown as ReturnType<GameEngine["getTransitionSnapshotFn"]>),
		);
		Effect.runSync(surface.redrawFx);
		expect(Effect.runSync(surface.readTargetFactsFx(2 * 512 + 1, 1)).target).toBeNull();
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
		Effect.runSync(
			surface.setTransitionFx({
				runtime: {
					currentSpace: 1,
					templateUidBySpace: {
						1: "wide",
					},
				},
			} as unknown as ReturnType<GameEngine["getTransitionSnapshotFn"]>),
		);
		Effect.runSync(surface.redrawFx);
		expect(Effect.runSync(surface.readTargetFactsFx(2 * 512 + 1, 1)).target).not.toBeNull();
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

		expect(owned).toHaveLength(6);
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
