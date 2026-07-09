import { z } from "zod";

export const TitleSchema = z.string().trim().min(1);

export type TitleSchema = typeof TitleSchema;

export namespace TitleSchema {
	export type Type = z.infer<TitleSchema>;
}
