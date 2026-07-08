import { z } from "zod";

export const ItemKindSchema = z.enum([
	"item",
	"producer",
	"blueprint",
	"quest",
	"special",
]);
