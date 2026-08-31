import { type RefObject, useCallback, useEffect, useRef } from "react";

import type { ItemOriginItemNode } from "~/flow/type/ItemOriginFlow";
import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";

const MaxCachedImages = 96;

interface ArtworkLayer {
	readonly height: number;
	readonly image: HTMLImageElement;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

/** Owns the bounded image cache and artwork resource lifetime for one mounted Flow Canvas. */
export const useCanvasArtworkPainter = (onImageReadyRef: RefObject<() => void>) => {
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

	useEffect(
		() => () => {
			for (const image of imageCacheRef.current.values()) image.src = "";
			imageCacheRef.current.clear();
		},
		[],
	);

	return useCallback(
		(
			context: CanvasRenderingContext2D,
			node: ItemOriginItemNode,
			resourceUrls: ReadonlyMap<string, string>,
			x: number,
			y: number,
			size: number,
			palette: CanvasPalette,
		) => {
			const images = [
				resourceUrls.get(node.resourceIds[0]),
				resourceUrls.get(node.resourceIds[1] ?? ""),
			].map((url) => {
				if (url === undefined) return undefined;
				const existing = imageCacheRef.current.get(url);
				if (existing !== undefined) {
					imageCacheRef.current.delete(url);
					imageCacheRef.current.set(url, existing);
					return existing.complete && existing.naturalWidth > 0 ? existing : undefined;
				}
				const image = new Image();
				image.decoding = "async";
				image.onload = () => onImageReadyRef.current();
				image.onerror = () => onImageReadyRef.current();
				imageCacheRef.current.set(url, image);
				while (imageCacheRef.current.size > MaxCachedImages) {
					const oldestUrl = imageCacheRef.current.keys().next().value;
					if (oldestUrl === undefined) break;
					const oldest = imageCacheRef.current.get(oldestUrl);
					if (oldest !== undefined) oldest.src = "";
					imageCacheRef.current.delete(oldestUrl);
				}
				image.src = url;
				return undefined;
			});
			const background = images[0];
			const foreground = images[1];
			if (background === undefined) {
				context.fillStyle = palette.muted;
				context.font = "600 22px Inter, ui-sans-serif, system-ui, sans-serif";
				context.textAlign = "center";
				context.fillText("?", x + size / 2, y + size / 2 + 8);
				context.textAlign = "start";
				return;
			}
			const layers: ReadonlyArray<ArtworkLayer> =
				foreground === undefined
					? [
							{
								height: size,
								image: background,
								width: size,
								x,
								y,
							},
						]
					: [
							{
								height: size * 0.74,
								image: background,
								width: size * 0.74,
								x,
								y,
							},
							{
								height: size * 0.74,
								image: foreground,
								width: size * 0.74,
								x: x + size - size * 0.74,
								y: y + size - size * 0.74,
							},
						];
			for (const layer of layers) {
				const scale = Math.min(
					layer.width / layer.image.naturalWidth,
					layer.height / layer.image.naturalHeight,
				);
				const drawWidth = layer.image.naturalWidth * scale;
				const drawHeight = layer.image.naturalHeight * scale;
				context.drawImage(
					layer.image,
					layer.x + (layer.width - drawWidth) / 2,
					layer.y + (layer.height - drawHeight) / 2,
					drawWidth,
					drawHeight,
				);
			}
		},
		[
			onImageReadyRef,
		],
	);
};
