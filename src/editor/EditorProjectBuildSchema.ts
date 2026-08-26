import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

export const EditorProjectBuildSchema = z
	.object({
		projectId: IdSchema,
		revision: z.number().int().nonnegative(),
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		signed: z.boolean(),
		size: z.number().int().nonnegative(),
		diagnostics: GameDiagnosticsSchema,
	})
	.strict()
	.meta({
		id: "EditorProjectBuildSchema",
		description: "One canonical filesystem artifact built from an exact Editor revision.",
	});

export type EditorProjectBuildSchema = typeof EditorProjectBuildSchema;

export namespace EditorProjectBuildSchema {
	export type Type = z.infer<EditorProjectBuildSchema>;
}

export const EditorProjectBuildContentSchema = z
	.object({
		bytes: z.instanceof(Uint8Array),
		signature: ArkpackSignatureSchema.optional(),
	})
	.strict()
	.meta({
		id: "EditorProjectBuildContentSchema",
		description: "Bounded bytes read from one exact current Editor build artifact.",
	});

export type EditorProjectBuildContentSchema = typeof EditorProjectBuildContentSchema;

export namespace EditorProjectBuildContentSchema {
	export type Type = z.infer<EditorProjectBuildContentSchema>;
}
