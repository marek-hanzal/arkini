import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { QuantityRangeSchema } from "./QuantityRangeSchema";

export const QuantityValueSchema = z.union([CountSchema, QuantityRangeSchema]);
