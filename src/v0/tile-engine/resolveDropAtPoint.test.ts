import { afterEach, describe, expect, it } from "vitest";
import { resolveDropAtPoint } from "~/v0/tile-engine/resolveDropAtPoint";
import type { TileEngineDrop } from "~/v0/tile-engine/TileEngineDrop.types";

const originalDocument = globalThis.document;

const createElement = (name: string) => {
	const element = {
		name,
		contains(other: unknown) {
			return other === element;
		},
		getBoundingClientRect() {
			return {
				left: 0,
				top: 0,
				right: 100,
				bottom: 100,
				width: 100,
				height: 100,
			};
		},
	} as unknown as HTMLElement;

	return element;
};

const createDrop = (dropId: string, element: HTMLElement): TileEngineDrop.Registration => ({
	dropId,
	element,
	payload: dropId,
	slot: null,
	targetTile: undefined,
});

describe("resolveDropAtPoint", () => {
	afterEach(() => {
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: originalDocument,
		});
	});

	it("prefers the visually topmost registered drop over insertion order", () => {
		const covered = createElement("covered");
		const top = createElement("top");
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: {
				elementsFromPoint: () => [
					top,
					covered,
				],
			},
		});

		const drops = new Map([
			[
				"covered",
				createDrop("covered", covered),
			],
			[
				"top",
				createDrop("top", top),
			],
		]);

		expect(resolveDropAtPoint(drops, 50, 50)?.dropId).toBe("top");
	});

	it("falls back to geometry when elementsFromPoint is unavailable", () => {
		const drop = createElement("drop");
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: {},
		});

		expect(
			resolveDropAtPoint(
				new Map([
					[
						"drop",
						createDrop("drop", drop),
					],
				]),
				50,
				50,
			)?.dropId,
		).toBe("drop");
	});
});
