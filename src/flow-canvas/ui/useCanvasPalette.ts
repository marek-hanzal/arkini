import { type RefObject, useCallback, useEffect, useRef } from "react";

import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";

const CanvasColorToken = {
	accent: "--ak-accent",
	canvas: "--ak-canvas",
	danger: "--ak-danger",
	foreground: "--ak-foreground",
	info: "--ak-info",
	itemBlueprint: "--ak-flow-item-blueprint-surface",
	itemCraft: "--ak-flow-item-craft-surface",
	itemDeposit: "--ak-flow-item-deposit-surface",
	itemInventory: "--ak-flow-item-inventory-surface",
	itemMissing: "--ak-flow-item-missing-surface",
	itemProducer: "--ak-flow-item-producer-surface",
	itemSimple: "--ak-flow-item-simple-surface",
	itemStash: "--ak-flow-item-stash-surface",
	itemTemporary: "--ak-flow-item-temporary-surface",
	line: "--ak-line",
	lineStrong: "--ak-line-strong",
	muted: "--ak-muted",
	sourceCharges: "--ak-flow-source-charges-surface",
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
				itemSurfaces: {
					blueprint: colors.itemBlueprint,
					craft: colors.itemCraft,
					deposit: colors.itemDeposit,
					inventory: colors.itemInventory,
					missing: colors.itemMissing,
					producer: colors.itemProducer,
					simple: colors.itemSimple,
					space: colors.itemSimple,
					stash: colors.itemStash,
					temporary: colors.itemTemporary,
				},
				line: colors.line,
				lineStrong: colors.lineStrong,
				muted: colors.muted,
				sourceSurfaces: {
					charges: colors.sourceCharges,
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
