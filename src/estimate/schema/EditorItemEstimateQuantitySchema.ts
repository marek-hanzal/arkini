import { z } from "zod";

/** Keeps static estimate work bounded for interactive editor and MCP requests. */
export const editorItemEstimateMaximumQuantity = 10_000;

export const EditorItemEstimateQuantitySchema = z
	.number()
	.int()
	.positive()
	.max(editorItemEstimateMaximumQuantity)
	.describe(`Target quantity from 1 to ${editorItemEstimateMaximumQuantity}; defaults to 1.`);
