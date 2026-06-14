import { z } from "zod";

export const BoardCoordinateSchema = z.number().int().min(0);
