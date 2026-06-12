import { z } from "zod";

export const NonNegativeIntegerSchema = z.number().int().nonnegative();
