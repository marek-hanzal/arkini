import { z } from "zod";

export const NeighborDirectionSchema = z.enum([
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
	"nw",
	"any",
]);
