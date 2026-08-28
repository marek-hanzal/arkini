import type { EditorItemOriginItemNode } from "~/editor/origin-flow/EditorItemOriginFlow";
import type { CanvasPalette } from "~/ui/item/editor/origin-flow/CanvasPalette";

const MaxCachedImages = 96;

const readReadyImage = (
	cache: Map<string, HTMLImageElement>,
	url: string | undefined,
	onReady: () => void,
) => {
	if (url === undefined) return undefined;
	const existing = cache.get(url);
	if (existing !== undefined) {
		cache.delete(url);
		cache.set(url, existing);
		return existing.complete && existing.naturalWidth > 0 ? existing : undefined;
	}
	const image = new Image();
	image.decoding = "async";
	image.onload = onReady;
	image.onerror = onReady;
	cache.set(url, image);
	while (cache.size > MaxCachedImages) {
		const oldestUrl = cache.keys().next().value;
		if (oldestUrl === undefined) break;
		const oldest = cache.get(oldestUrl);
		if (oldest !== undefined) oldest.src = "";
		cache.delete(oldestUrl);
	}
	image.src = url;
	return undefined;
};

const drawContainedImage = (
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number,
) => {
	const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
	const drawWidth = image.naturalWidth * scale;
	const drawHeight = image.naturalHeight * scale;
	context.drawImage(
		image,
		x + (width - drawWidth) / 2,
		y + (height - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
};

const drawItemArtwork = (
	context: CanvasRenderingContext2D,
	node: EditorItemOriginItemNode,
	resourceUrls: ReadonlyMap<string, string>,
	imageCache: Map<string, HTMLImageElement>,
	onImageReady: () => void,
	x: number,
	y: number,
	size: number,
	palette: CanvasPalette,
) => {
	const background = readReadyImage(
		imageCache,
		resourceUrls.get(node.resourceIds[0]),
		onImageReady,
	);
	const foreground = readReadyImage(
		imageCache,
		resourceUrls.get(node.resourceIds[1] ?? ""),
		onImageReady,
	);
	if (background === undefined) {
		context.fillStyle = palette.muted;
		context.font = "600 22px Inter, ui-sans-serif, system-ui, sans-serif";
		context.textAlign = "center";
		context.fillText("?", x + size / 2, y + size / 2 + 8);
		context.textAlign = "start";
		return;
	}
	if (foreground === undefined) {
		drawContainedImage(context, background, x, y, size, size);
		return;
	}
	const layerSize = size * 0.74;
	drawContainedImage(context, background, x, y, layerSize, layerSize);
	drawContainedImage(
		context,
		foreground,
		x + size - layerSize,
		y + size - layerSize,
		layerSize,
		layerSize,
	);
};

/** Creates item-artwork composition backed by the bounded Canvas image cache. */
export const createCanvasArtworkPainterFx = Effect.fn("createCanvasArtworkPainterFx")(() =>
	Effect.succeed({
		drawItemArtwork,
	} as const),
);
import { Effect } from "effect";
