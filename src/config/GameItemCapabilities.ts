import type { GameConfig } from "~/config/GameConfigTypes";

type GameItemDefinition = GameConfig["items"][string];
export type GameProducerDefinition = NonNullable<GameItemDefinition["producer"]>;
export type GameStashDefinition = NonNullable<GameItemDefinition["stash"]>;
export type GameProducerCapabilityDefinition = GameProducerDefinition | GameStashDefinition;
export type GameLineDefinition =
	| GameProducerDefinition["lines"][number]
	| GameStashDefinition["line"];
export type GameCraftRecipeDefinition = NonNullable<GameItemDefinition["craft"]>;
export type GameMergeRuleDefinition = NonNullable<GameItemDefinition["merges"]>[number];

export const readProducerCapabilityDefinition = ({
	config,
	producerId,
}: {
	config: GameConfig;
	producerId: string;
}) => {
	const item = config.items[producerId];
	return item?.producer ?? item?.stash;
};

const readLineDefinitions = ({
	producerDefinition,
}: {
	producerDefinition: GameProducerCapabilityDefinition;
}): readonly GameLineDefinition[] =>
	"line" in producerDefinition
		? [
				producerDefinition.line,
			]
		: producerDefinition.lines;

export const readLineIds = ({
	producerDefinition,
}: {
	producerDefinition: GameProducerCapabilityDefinition;
}) =>
	readLineDefinitions({
		producerDefinition,
	}).map((line) => line.id);

export const readLineDefinition = ({
	producerDefinition,
	lineId,
}: {
	producerDefinition: GameProducerCapabilityDefinition;
	lineId: string;
}) =>
	readLineDefinitions({
		producerDefinition,
	}).find((line) => line.id === lineId);

export const readLineDefinitionFromConfig = ({
	config,
	producerId,
	lineId,
}: {
	config: GameConfig;
	producerId: string;
	lineId: string;
}) => {
	const producerDefinition = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	return producerDefinition
		? readLineDefinition({
				producerDefinition,
				lineId,
			})
		: undefined;
};

export const readCraftRecipeDefinition = ({
	config,
	recipeId,
}: {
	config: GameConfig;
	recipeId: string;
}) => config.items[recipeId]?.craft;

export const readItemMergeRules = ({ config, itemId }: { config: GameConfig; itemId: string }) =>
	config.items[itemId]?.merges ?? [];
