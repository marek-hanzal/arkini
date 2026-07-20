import { z } from "zod";

/** Number of slots in the optional passive toolbar. Zero disables the toolbar. */
export const ToolbarSizeSchema = z.number().int().min(0).max(64).meta({
	id: "ToolbarSizeSchema",
	description: "The optional toolbar slot count from zero through sixty-four.",
});

export type ToolbarSizeSchema = typeof ToolbarSizeSchema;

export namespace ToolbarSizeSchema {
	export type Type = z.infer<ToolbarSizeSchema>;
}
