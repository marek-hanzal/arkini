import { z } from "zod";

/** Keeps static estimate work bounded for interactive editor and MCP requests. */
export const itemEstimateMaximumQuantity = 10_000;

export const ItemEstimateQuantitySchema = z
	.number()
	.int()
	.positive()
	.max(itemEstimateMaximumQuantity)
	.describe(`Target quantity from 1 to ${itemEstimateMaximumQuantity}; defaults to 1.`);
