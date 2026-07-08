import { z } from "zod";

export const RemovalToolModeSchema = z.enum(["consume", "keep"]);
