import { z } from "zod";

export const DurationMsSchema = z.number().int().positive();
