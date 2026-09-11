import type { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";

/** The authored default for a layer without custom shadow settings. All distances are canvas pixels. */
export const TilePaintingDefaultShadow: Readonly<TilePaintingDocumentSchema.Shadow> = {
	enabled: true,
	color: "#31192b",
	opacity: 0.35,
	blur: 12,
	offsetX: 8,
	offsetY: 12,
};
