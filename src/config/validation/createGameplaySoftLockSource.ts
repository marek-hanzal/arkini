import type { GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import type {
	GameplayRequirement,
	GameplaySource,
} from "~/config/validation/GameplaySoftLockTypes";

type GameplaySourceInput = {
	label: string;
	path: GameConfigIssuePath;
	requirements: GameplayRequirement[];
	sourceId: string;
	targetId: string;
};

export const createGameplayItemSource = ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
}: GameplaySourceInput): GameplaySource => ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
	targetKind: "item",
});

export const createGameplayGrantSource = ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
}: GameplaySourceInput): GameplaySource => ({
	label,
	path,
	requirements,
	sourceId,
	targetId,
	targetKind: "grant",
});
