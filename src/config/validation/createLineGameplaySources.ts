import type { GameConfig } from "~/config/GameConfigTypes";
import {
	createGameplayGrantSource,
	createGameplayItemSource,
} from "~/config/validation/createGameplaySoftLockSource";
import { readConfigLines } from "~/config/validation/GameConfigValidationReaders";
import {
	createItemRequirement,
	readGameplayOutputSourceEntries,
	readLineEffectGameplayRequirements,
} from "~/config/validation/GameplaySoftLockRequirements";
import type { GameplayRequirement } from "~/config/validation/GameplaySoftLockTypes";

type GameplayLineSourceEntry = Pick<
	ReturnType<typeof readConfigLines>[number],
	"line" | "linePath" | "ownerItemId"
>;

const readLineBaseGameplayRequirements = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry): GameplayRequirement[] => [
	createItemRequirement({
		itemId: ownerItemId,
		path: [
			"items",
			ownerItemId,
		],
	}),
	...(line.inputs ?? []).map((input, inputIndex) =>
		createItemRequirement({
			itemId: input.itemId,
			path: [
				...linePath,
				"inputs",
				inputIndex,
				"itemId",
			],
		}),
	),
	...readLineEffectGameplayRequirements({
		lineEffects: line.effects ?? [],
		path: [
			...linePath,
			"effects",
		],
	}),
];

const createLineOutputGameplaySources = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry) => {
	const lineRequirements = readLineBaseGameplayRequirements({
		line,
		linePath,
		ownerItemId,
	});
	return readGameplayOutputSourceEntries({
		line,
		output: line.output ?? [],
		path: [
			...linePath,
			"output",
		],
	}).map((outputEntry) =>
		createGameplayItemSource({
			label: `line "${line.id}" (${line.name})`,
			path: linePath,
			requirements: [
				...lineRequirements,
				...outputEntry.availabilityRequirements,
				...readLineEffectGameplayRequirements({
					lineEffects: outputEntry.effects,
					path: [
						...outputEntry.path,
						"effects",
					],
				}),
			],
			sourceId: `line:${ownerItemId}:${line.id}:output:${outputEntry.sourceKey}`,
			targetId: outputEntry.itemId,
		}),
	);
};

const createLineEffectGameplaySources = ({
	line,
	linePath,
	ownerItemId,
}: GameplayLineSourceEntry) => {
	if (!line.effect) return [];

	const lineRequirements = readLineBaseGameplayRequirements({
		line,
		linePath,
		ownerItemId,
	});
	return line.effect.grants.map((grant) =>
		createGameplayGrantSource({
			label: `active effect line "${line.id}" (${line.name})`,
			path: [
				...linePath,
				"effect",
			],
			requirements: lineRequirements,
			sourceId: `line:${ownerItemId}:${line.id}:active:${line.effect?.id}:${grant.id}`,
			targetId: grant.id,
		}),
	);
};

const createLineSourceEntries = (entry: GameplayLineSourceEntry) => [
	...createLineOutputGameplaySources(entry),
	...createLineEffectGameplaySources(entry),
];

export const createLineGameplaySources = (config: GameConfig) =>
	readConfigLines(config).flatMap(createLineSourceEntries);
