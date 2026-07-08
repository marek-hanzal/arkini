import { z } from "zod";

export const NeighborChanceModeSchema = z.enum(["sum", "max"]);
