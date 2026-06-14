import { z } from "zod";

export const GameActionActivationSchema = z.enum([
	"single",
	"exhaust",
]);
