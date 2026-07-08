import { z } from "zod";

export const CountSchema = z.number().int().positive();
