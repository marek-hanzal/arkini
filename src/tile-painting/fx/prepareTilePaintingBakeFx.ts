import { Effect } from "effect";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { planTilePaintingBakeFn } from "~/tile-painting/fn/planTilePaintingBakeFn";
import { renderTilePaintingPngFx } from "~/tile-painting/fx/renderTilePaintingPngFx";
import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

export namespace prepareTilePaintingBakeFx {
	export interface Props {
		readonly document: TilePaintingDocumentSchema.Type;
		readonly resources: ReadonlyArray<ResourceSchema.Type>;
		readonly outputResourceId: string;
		/** Bake-all may refer to guide-only outputs that will be produced later in the batch. */
		readonly deferredResourceIds?: ReadonlySet<string>;
	}
	export interface Output {
		readonly document: TilePaintingDocumentSchema.Type;
		readonly bakedPng: string;
	}
}

/** Render canonical Assets after validating output dependencies; guides do not enter the PNG. */
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
	return {
		document,
		bakedPng: yield* renderTilePaintingPngFx(document, resources),
	} satisfies prepareTilePaintingBakeFx.Output;
});
