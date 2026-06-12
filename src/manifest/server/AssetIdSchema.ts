import { z } from "zod";

export const AssetIdSchema = z.string().startsWith("asset:");
