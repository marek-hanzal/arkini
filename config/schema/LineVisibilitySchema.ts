import { z } from "zod";

export const LineVisibilitySchema = z.enum(["visible", "hidden"]);
