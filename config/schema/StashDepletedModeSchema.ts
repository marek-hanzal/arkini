import { z } from "zod";

export const StashDepletedModeSchema = z.enum(["remove", "keep"]);
