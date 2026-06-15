import { z } from "zod";

export const GameLootTableIdSchema = z.enum([
	"loot:tree",
	"loot:townhall-1",
	"loot:townhall-2",
	"loot:townhall-3",
	"loot:townhall-4",
	"loot:townhall-5",
	"loot:lumber-camp-1",
	"loot:lumber-camp-2",
	"loot:lumber-camp-3",
	"loot:lumber-camp-4",
	"loot:lumber-camp-5",
	"loot:quarry-1",
	"loot:quarry-2",
	"loot:quarry-3",
	"loot:quarry-4",
	"loot:quarry-5",
	"loot:coal-mine-1",
	"loot:crate-1",
	"loot:crate-2",
	"loot:crate-3",
	"loot:crate-4",
	"loot:lumber-camp-1:better-1",
	"loot:lumber-camp-1:better-2",
	"loot:quarry-1:better-1",
	"loot:quarry-1:better-2",
]);

type GameLootTableIdSchema = typeof GameLootTableIdSchema;
export namespace GameLootTableIdSchema {
	export type Type = z.infer<GameLootTableIdSchema>;
}
