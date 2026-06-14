import { z } from "zod";

export const ResourceIdSchema = z.string().startsWith("resource:");
