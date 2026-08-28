import { z } from "zod";

export const ChatGptAssetCandidateMaxBytes = 16 * 1024 * 1024;
export const ChatGptAssetCandidateFilenameMaxLength = 1_024;

const ChatGptSurfaceBoundsSchema = z
	.object({
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
		width: z.number().int().nonnegative(),
		height: z.number().int().nonnegative(),
	})
	.strict();

export const ChatGptSurfaceSchema = z
	.object({
		projectId: z.string().min(1),
		bounds: ChatGptSurfaceBoundsSchema,
	})
	.strict();

export type ChatGptSurfaceSchema = typeof ChatGptSurfaceSchema;

export namespace ChatGptSurfaceSchema {
	export type Type = z.infer<ChatGptSurfaceSchema>;
}

export const ChatGptViewStateSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("loading"),
		})
		.strict(),
	z
		.object({
			type: z.literal("ready"),
		})
		.strict(),
	z
		.object({
			type: z.literal("unavailable"),
			message: z.string().min(1),
		})
		.strict(),
]);

export type ChatGptViewStateSchema = typeof ChatGptViewStateSchema;

export namespace ChatGptViewStateSchema {
	export type Type = z.infer<ChatGptViewStateSchema>;
}

export const ChatGptAssetCandidateSchema = z
	.object({
		projectId: z.string().min(1),
		filename: z.string().min(1).max(ChatGptAssetCandidateFilenameMaxLength),
		bytes: z
			.instanceof(Uint8Array)
			.refine((bytes) => bytes.byteLength <= ChatGptAssetCandidateMaxBytes),
	})
	.strict();

export type ChatGptAssetCandidateSchema = typeof ChatGptAssetCandidateSchema;

export namespace ChatGptAssetCandidateSchema {
	export type Type = z.infer<ChatGptAssetCandidateSchema>;
}
