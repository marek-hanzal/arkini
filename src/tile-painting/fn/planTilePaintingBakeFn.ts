import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace planTilePaintingBakeFn {
	export interface Painting {
		readonly paintingId: string;
		readonly outputResourceId: string | null;
		readonly document: TilePaintingDocumentSchema.Type;
	}
	export interface Props {
		readonly paintings: ReadonlyArray<Painting>;
		readonly resourceIds: ReadonlyArray<string>;
	}
	export interface Step {
		readonly paintingId: string;
		readonly outputResourceId: string;
		readonly renderedSourceIds: ReadonlyArray<string>;
	}
	export type Output =
		| {
				readonly type: "ready";
				readonly steps: ReadonlyArray<Step>;
				readonly skippedCount: number;
		  }
		| {
				readonly type: "invalid";
				readonly reason: "duplicate-output" | "cycle" | "missing-source";
				readonly message: string;
		  };
}

const readRenderedSourceIdsFn = (
	document: TilePaintingDocumentSchema.Type,
): ReadonlyArray<string> => {
	const images = new Map(
		document.images.map((image) => [
			image.id,
			image.sourceResourceId,
		]),
	);
	const imageIds = [
		...document.layers
			.filter((layer) => layer.visible && layer.opacity > 0)
			.flatMap((layer) => [
				layer.imageId,
				...layer.strokes.flatMap((stroke) =>
					stroke.shape === "image" && stroke.brushImageId !== null
						? [
								stroke.brushImageId,
							]
						: [],
				),
			]),
		...document.scatter.flatMap((stroke) => stroke.stamps.map((stamp) => stamp.imageId)),
	];
	return [
		...new Set(
			imageIds.flatMap((id) => {
				const sourceId = images.get(id);
				return sourceId === undefined
					? []
					: [
							sourceId,
						];
			}),
		),
	];
};

/** Guides never order builds: only material/brush pixels and placed decorations consume another output. */
export const planTilePaintingBakeFn = ({
	paintings,
	resourceIds,
}: planTilePaintingBakeFn.Props): planTilePaintingBakeFn.Output => {
	const outputs = new Map<string, planTilePaintingBakeFn.Painting>();
	const candidates = paintings.filter((painting) => painting.outputResourceId !== null);
	for (const painting of candidates) {
		const output = painting.outputResourceId!;
		if (outputs.has(output))
			return {
				type: "invalid",
				reason: "duplicate-output",
				message: `More than one painting owns output asset ${output}.`,
			};
		outputs.set(output, painting);
	}
	const available = new Set([
		...resourceIds,
		...outputs.keys(),
	]);
	for (const painting of candidates) {
		const referenced = readTilePaintingReferencedImageIdsFn(painting.document);
		const missing = painting.document.images.find(
			(image) => referenced.has(image.id) && !available.has(image.sourceResourceId),
		);
		if (missing !== undefined)
			return {
				type: "invalid",
				reason: "missing-source",
				message: `Painting ${painting.document.name} is missing source asset ${missing.sourceResourceId}.`,
			};
	}
	const pending = candidates.map((painting) => ({
		paintingId: painting.paintingId,
		outputResourceId: painting.outputResourceId!,
		renderedSourceIds: readRenderedSourceIdsFn(painting.document),
	}));
	const steps: Array<planTilePaintingBakeFn.Step> = [];
	const completed = new Set<string>();
	while (pending.length > 0) {
		const nextIndex = pending.findIndex((step) =>
			step.renderedSourceIds.every((id) => !outputs.has(id) || completed.has(id)),
		);
		if (nextIndex < 0)
			return {
				type: "invalid",
				reason: "cycle",
				message: `Painting outputs form a rendering cycle: ${pending.map((step) => step.outputResourceId).join(", ")}.`,
			};
		const [step] = pending.splice(nextIndex, 1);
		steps.push(step);
		completed.add(step.outputResourceId);
	}
	return {
		type: "ready",
		steps,
		skippedCount: paintings.length - candidates.length,
	};
};
