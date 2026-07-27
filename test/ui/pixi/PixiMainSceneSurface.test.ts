import { Effect } from "effect";
import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
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
				readActors: () => [],
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
