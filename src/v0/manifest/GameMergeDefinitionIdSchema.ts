import { z } from "zod";

export const GameMergeDefinitionIdSchema = z.enum([
	"merge:seed-seed-sprout",
	"merge:sprout-sprout-leaf",
	"merge:leaf-leaf-bush",
	"merge:bush-bush-sapling",
	"merge:twig-twig-branch",
	"merge:water-twig-sprout",
	"merge:branch-branch-log",
	"merge:log-log-wood-bundle",
	"merge:wood-bundle-wood-bundle-plank",
	"merge:plank-plank-beam",
	"merge:pebble-pebble-stone",
	"merge:stone-stone-stone-block",
	"merge:stone-water-crystal",
	"merge:stone-block-stone-block-ore",
	"merge:ore-ore-crystal",
	"merge:crystal-crystal-gem",
	"merge:coin-coin-pair",
	"merge:coin-pair-stack",
	"merge:coin-stack-chest",
	"merge:blueprint-scrap-fragment",
	"merge:blueprint-fragment-draft",
	"merge:blueprint-draft-final",
	"merge:townhall-1-blueprint",
	"merge:townhall-2-blueprint",
	"merge:townhall-3-blueprint",
	"merge:townhall-4-blueprint",
	"merge:townhall-5-blueprint",
	"merge:lumber-camp-1-blueprint",
	"merge:lumber-camp-2-blueprint",
	"merge:lumber-camp-3-blueprint",
	"merge:lumber-camp-4-blueprint",
	"merge:lumber-camp-5-blueprint",
	"merge:quarry-1-blueprint",
	"merge:quarry-2-blueprint",
	"merge:quarry-3-blueprint",
	"merge:quarry-4-blueprint",
	"merge:quarry-5-blueprint",
	"merge:crate-1-crate-2",
	"merge:crate-2-crate-3",
	"merge:crate-3-crate-4",
]);

type GameMergeDefinitionIdSchema = typeof GameMergeDefinitionIdSchema;
export namespace GameMergeDefinitionIdSchema {
	export type Type = z.infer<GameMergeDefinitionIdSchema>;
}
