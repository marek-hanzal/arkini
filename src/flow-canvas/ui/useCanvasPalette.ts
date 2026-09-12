import { type RefObject, useCallback, useEffect, useRef } from "react";

import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";

const CanvasColorToken = {
	accent: "--ak-accent",
	canvas: "--ak-canvas",
	danger: "--ak-danger",
	foreground: "--ak-foreground",
	info: "--ak-info",
	item: "--ak-flow-item-surface",
	itemMissing: "--ak-flow-item-missing-surface",
	line: "--ak-line",
	lineStrong: "--ak-line-strong",
	muted: "--ak-muted",
	sourceUnits: "--ak-flow-source-units-surface",
	sourceExpiry: "--ak-flow-source-expiry-surface",
	sourceLine: "--ak-flow-source-line-surface",
	sourceMerge: "--ak-flow-source-merge-surface",
	success: "--ak-success",
	warning: "--ak-warning",
} as const;

/** Owns theme-token caching and invalidation for one mounted Flow Canvas. */
export const useCanvasPalette = (scheduleDrawRef: RefObject<() => void>) => {
	const paletteRef = useRef<CanvasPalette | undefined>(undefined);

	useEffect(() => {
		const observer = new MutationObserver(() => {
			paletteRef.current = undefined;
			scheduleDrawRef.current();
		});
		observer.observe(document.documentElement, {
			attributeFilter: [
				"data-accent",
				"data-theme",
			],
			attributes: true,
		});
		const scheme = matchMedia("(prefers-color-scheme: dark)");
		const listener = new AbortController();
		scheme.addEventListener(
			"change",
			() => {
				paletteRef.current = undefined;
				scheduleDrawRef.current();
			},
			{
				signal: listener.signal,
			},
		);
		return () => {
			observer.disconnect();
			listener.abort();
		};
	}, [
		scheduleDrawRef,
	]);

	return useCallback((host: HTMLElement) => {
		if (paletteRef.current !== undefined) return paletteRef.current;
		const probe = document.createElement("span");
		probe.style.display = "none";
		(host.parentElement ?? document.body).append(probe);
		let palette: CanvasPalette;
		try {
			const colors = Object.fromEntries(
				Object.entries(CanvasColorToken).map(([name, property]) => {
					probe.style.color = `var(${property})`;
					return [
						name,
						getComputedStyle(probe).color,
					];
				}),
			) as Record<keyof typeof CanvasColorToken, string>;
			palette = {
				accent: colors.accent,
				canvas: colors.canvas,
				danger: colors.danger,
				foreground: colors.foreground,
				info: colors.info,
				itemSurface: colors.item,
				missingItemSurface: colors.itemMissing,
				line: colors.line,
				lineStrong: colors.lineStrong,
				muted: colors.muted,
				sourceSurfaces: {
					units: colors.sourceUnits,
					expiry: colors.sourceExpiry,
					line: colors.sourceLine,
					merge: colors.sourceMerge,
				},
				success: colors.success,
				warning: colors.warning,
			};
		} finally {
			probe.remove();
		}
		paletteRef.current = palette;
		return palette;
	}, []);
};
