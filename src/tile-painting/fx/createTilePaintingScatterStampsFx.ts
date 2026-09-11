import { Effect, Random } from "effect";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** Resolves weighted decoration choices into exact placements retained by the recipe. */
export const createTilePaintingScatterStampsFx = (
	catalog: TilePaintingDocumentSchema.Type["catalog"],
	points: ReadonlyArray<TilePaintingDocumentSchema.Point>,
	radius: number,
) =>
	Effect.gen(function* () {
		const palette = catalog.filter((item) => item.enabled && item.weight > 0);
		const stamps: Array<TilePaintingDocumentSchema.Stamp> = [];
		if (palette.length === 0) return stamps;
		const totalWeight = palette.reduce((sum, item) => sum + item.weight, 0);
		for (const point of points) {
			let remainingWeight = (yield* Random.next) * totalWeight;
			let item = palette[palette.length - 1];
			for (const candidate of palette) {
				if (remainingWeight < candidate.weight) {
					item = candidate;
					break;
				}
				remainingWeight -= candidate.weight;
			}
			const angle = (yield* Random.next) * Math.PI * 2;
			const distance = Math.sqrt(yield* Random.next) * radius;
			stamps.push({
				imageId: item.imageId,
				x: point.x + Math.cos(angle) * distance,
				y: point.y + Math.sin(angle) * distance,
				size: item.minSize + (yield* Random.next) * (item.maxSize - item.minSize),
			});
		}
		return stamps;
	});
