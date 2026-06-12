import { z } from "zod";

export const PositiveIntegerSchema = z.number().int().positive();
