import { readTilePaintingReferencedImageIdsFn } from "~/tile-painting/fn/readTilePaintingReferencedImageIdsFn";
import { Effect } from "effect";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { planTilePaintingBakeFn } from "~/tile-painting/fn/planTilePaintingBakeFn";
import { refreshTilePaintingSourcesFx } from "~/tile-painting/fx/refreshTilePaintingSourcesFx";
import { renderTilePaintingPngFx } from "~/tile-painting/fx/renderTilePaintingPngFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace prepareTilePaintingBakeFx {
	export interface Props {
		readonly document: TilePaintingDocumentSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly outputResourceId: string;
		/** Bake-all resolves guide-only references to later outputs in its final snapshot pass. */
		readonly deferredResourceIds?: ReadonlySet<string>;
	}
	export interface Output {
		readonly document: TilePaintingDocumentSchema.Type;
		readonly bakedPng: string;
	}
}

/** Refresh inputs, render once, then capture the new output when it is used only as an editor guide. */
export const prepareTilePaintingBakeFx = Effect.fn("prepareTilePaintingBakeFx")(function* ({
	document,
	resources,
	outputResourceId,
	deferredResourceIds,
}: prepareTilePaintingBakeFx.Props) {
	const plan = planTilePaintingBakeFn({
		paintings: [
			{
				paintingId: "current",
				outputResourceId,
				document,
			},
		],
		resourceIds: [
			...resources.map((resource) => resource.id),
			...(deferredResourceIds ?? []),
		],
	});
	if (plan.type === "invalid")
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-asset",
				message: plan.message,
			}),
		);
	const rendered = new Set(plan.steps[0].renderedSourceIds);
	const guides = new Set(
		[
			...(deferredResourceIds ?? []),
			outputResourceId,
		].filter((id) => !rendered.has(id)),
	);
	const refreshed = yield* refreshTilePaintingSourcesFx({
		document,
		resources,
		deferredResourceIds: guides,
	});
	const bakedPng = yield* renderTilePaintingPngFx(refreshed);
	const referenced = readTilePaintingReferencedImageIdsFn(refreshed);
	return {
		document: {
			...refreshed,
			images: refreshed.images.map((image) =>
				referenced.has(image.id) && image.sourceResourceId === outputResourceId
					? {
							...image,
							png: bakedPng,
						}
					: image,
			),
		},
		bakedPng,
	} satisfies prepareTilePaintingBakeFx.Output;
});
