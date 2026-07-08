import { z } from "zod";

export const TargetModeSchema = z.enum(["replace", "keep"]);
