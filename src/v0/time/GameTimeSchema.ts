import { z } from "zod";

export const GameInstantMsSchema = z.number().int().nonnegative();
