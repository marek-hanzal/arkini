import { rectFromElement } from "~/v0/tile-engine/rect";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace TileVisualSnapshot {
	export interface Type {
		readonly rect: TileEngine.Rect;
		readonly opacity: string;
		readonly transform: string;
		readonly translateX: number;
		readonly translateY: number;
	}
}

export const readTransformTranslate = (
	transform: string,
): {
	x: number;
	y: number;
} => {
	if (!transform || transform === "none")
		return {
			x: 0,
			y: 0,
		};

	const matrix = transform.match(/^matrix\((.+)\)$/u);
	if (matrix) {
		const values = matrix[1]?.split(",").map((value) => Number(value.trim())) ?? [];
		return {
			x: Number.isFinite(values[4]) ? (values[4] ?? 0) : 0,
			y: Number.isFinite(values[5]) ? (values[5] ?? 0) : 0,
		};
	}

	const matrix3d = transform.match(/^matrix3d\((.+)\)$/u);
	if (matrix3d) {
		const values = matrix3d[1]?.split(",").map((value) => Number(value.trim())) ?? [];
		return {
			x: Number.isFinite(values[12]) ? (values[12] ?? 0) : 0,
			y: Number.isFinite(values[13]) ? (values[13] ?? 0) : 0,
		};
	}

	const translate3d = transform.match(
		/^translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)$/u,
	);
	if (translate3d) {
		return {
			x: Number(translate3d[1] ?? 0),
			y: Number(translate3d[2] ?? 0),
		};
	}

	return {
		x: 0,
		y: 0,
	};
};

export const translate3d = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0px)`;

export const readTileVisualSnapshot = (element: HTMLElement): TileVisualSnapshot.Type => {
	const style = window.getComputedStyle(element);
	const transform = style.transform || "none";
	const translate = readTransformTranslate(transform);

	return {
		rect: rectFromElement(element),
		opacity: style.opacity,
		transform,
		translateX: translate.x,
		translateY: translate.y,
	};
};

export const freezeElementVisualState = (element: HTMLElement) => {
	const snapshot = readTileVisualSnapshot(element);
	element.style.transform = snapshot.transform === "none" ? "" : snapshot.transform;
	element.style.opacity = snapshot.opacity;
	return snapshot;
};
