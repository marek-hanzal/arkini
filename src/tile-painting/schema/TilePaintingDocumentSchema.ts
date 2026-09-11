import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";

const unit = z.number().min(0).max(1);
const size = z.number().min(1).max(4096);
const point = z
	.object({
		x: z.number().min(-4096).max(8192),
		y: z.number().min(-4096).max(8192),
	})
	.strict();
const png = z
	.string()
	.max(24 * 1024 * 1024)
	.regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/);

/** Portable, non-destructive painting recipe. Points are spaced brush dabs in canvas pixels. */
export const TilePaintingDocumentSchema = z
	.object({
		name: z.string().trim().min(1).max(120),
		images: z
			.array(
				z
					.object({
						id: IdSchema,
						label: z.string().max(240),
						sourceResourceId: IdSchema,
						png,
					})
					.strict(),
			)
			.max(128),
		layers: z
			.array(
				z
					.object({
						id: IdSchema,
						name: z.string().min(1).max(120),
						imageId: IdSchema,
						visible: z.boolean(),
						opacity: unit,
						tileSize: z.number().min(8).max(2048),
						shadow: z
							.object({
								enabled: z.boolean(),
								color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
								opacity: unit,
								blur: z.number().min(0).max(128),
								offsetX: z.number().min(-256).max(256),
								offsetY: z.number().min(-256).max(256),
							})
							.strict()
							.optional(),
						strokes: z
							.array(
								z
									.object({
										mode: z.enum([
											"reveal",
											"hide",
											"smooth",
										]),
										size,
										opacity: unit,
										hardness: unit,
										shape: z.enum([
											"circle",
											"square",
											"image",
										]),
										brushImageId: IdSchema.nullable(),
										points: z.array(point).min(1).max(100000),
									})
									.strict(),
							)
							.max(10000),
					})
					.strict(),
			)
			.max(16),
		catalog: z
			.array(
				z
					.object({
						id: IdSchema,
						imageId: IdSchema,
						weight: z.number().min(0).max(1000).default(1),
						minSize: size,
						maxSize: size,
						enabled: z.boolean(),
					})
					.strict()
					.refine(
						(value) => value.minSize <= value.maxSize,
						"Minimum size exceeds maximum size.",
					),
			)
			.max(128),
		scatter: z
			.array(
				z
					.object({
						stamps: z
							.array(
								z
									.object({
										imageId: IdSchema,
										...point.shape,
										size,
									})
									.strict(),
							)
							.min(1)
							.max(100000),
					})
					.strict(),
			)
			.max(10000),
		preview: z
			.object({
				columns: z.number().int().min(1).max(8),
				rows: z.number().int().min(1).max(8),
				cells: z
					.array(
						z
							.discriminatedUnion("kind", [
								z
									.object({
										kind: z.literal("painting"),
									})
									.strict(),
								z
									.object({
										kind: z.literal("image"),
										imageId: IdSchema,
									})
									.strict(),
							])
							.nullable(),
					)
					.max(64),
			})
			.strict()
			.refine(
				(preview) => preview.cells.length === preview.rows * preview.columns,
				"Preview cells must match the grid dimensions.",
			),
		reference: z
			.object({
				imageId: IdSchema,
				opacity: unit,
				visible: z.boolean(),
			})
			.strict()
			.nullable(),
	})
	.strict()
	.superRefine((document, context) => {
		const failFn = (message: string) =>
			context.addIssue({
				code: "custom",
				message,
			});
		const imageIds = new Set(document.images.map((image) => image.id));
		for (const values of [
			document.images,
			document.layers,
			document.catalog,
		]) {
			if (new Set(values.map((value) => value.id)).size !== values.length)
				failFn("Duplicate painting identity.");
		}
		const refs = [
			...document.preview.cells.flatMap((cell) =>
				cell?.kind === "image"
					? [
							cell.imageId,
						]
					: [],
			),
			...document.layers.flatMap((layer) => [
				layer.imageId,
				...layer.strokes.flatMap((stroke) =>
					stroke.brushImageId === null
						? []
						: [
								stroke.brushImageId,
							],
				),
			]),
			...document.catalog.map((item) => item.imageId),
			...document.scatter.flatMap((stroke) => stroke.stamps.map((stamp) => stamp.imageId)),
			...(document.reference === null
				? []
				: [
						document.reference.imageId,
					]),
		];
		if (refs.some((id) => !imageIds.has(id))) failFn("A painting image reference is missing.");
		if (
			document.layers.some((layer) =>
				layer.strokes.some(
					(stroke) => stroke.shape === "image" && stroke.brushImageId === null,
				),
			)
		)
			failFn("An image brush requires a source image.");
		const dabCount = document.layers.reduce(
			(sum, layer) =>
				sum + layer.strokes.reduce((count, stroke) => count + stroke.points.length, 0),
			0,
		);
		const stampCount = document.scatter.reduce((sum, stroke) => sum + stroke.stamps.length, 0);
		if (dabCount > 500000 || stampCount > 100000) failFn("Painting exceeds the stroke budget.");
		if (new TextEncoder().encode(JSON.stringify(document)).byteLength > 64 * 1024 * 1024)
			failFn("Painting exceeds the 64 MiB document budget.");
	});
export type TilePaintingDocumentSchema = typeof TilePaintingDocumentSchema;
export namespace TilePaintingDocumentSchema {
	export type Type = z.infer<TilePaintingDocumentSchema>;
	export type Layer = Type["layers"][number];
	export type Shadow = NonNullable<Layer["shadow"]>;
	export type Stroke = Layer["strokes"][number];
	export type Point = Stroke["points"][number];
	export type ScatterStroke = Type["scatter"][number];
	export type Stamp = ScatterStroke["stamps"][number];
	export type Image = Type["images"][number];
	export type Preview = Type["preview"];
	export type PreviewCell = Preview["cells"][number];
}
