import { z } from "zod";

export const TitleSchema = z.string().trim().min(1);

export const NonEmptyStringSchema = z.string().trim().min(1);

export const NonEmptyStringListSchema = z.tuple([NonEmptyStringSchema], NonEmptyStringSchema);

export const PositiveIntegerSchema = z.number().int().positive();

export const NonNegativeIntegerSchema = z.number().int().min(0);

export const PositiveNumberSchema = z.number().positive();

export const ChanceSchema = z.number().min(0).max(1);
