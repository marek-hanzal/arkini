import { z } from "zod";

export const GameActionActivationSchema = z.enum([
	"single",
	"exhaust",
]);

type GameActionActivationSchema = typeof GameActionActivationSchema;
export namespace GameActionActivationSchema {
	export type Type = z.infer<GameActionActivationSchema>;
}
