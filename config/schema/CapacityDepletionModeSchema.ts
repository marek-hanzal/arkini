import { z } from "zod";

export const CapacityDepletionModeSchema = z.enum(["remove", "replace"]);
