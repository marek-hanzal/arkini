import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEffectSourceInstance } from "~/v0/game/effects/GameEffectSourceInstance";
import { readChebyshevDistance } from "~/v0/game/effects/readChebyshevDistance";
import { readGameEffectSourceCell } from "~/v0/game/effects/readGameEffectSourceCell";

export namespace compareGameEffectSourceInstances {
	export interface Props {
		config: GameConfig;
		left: GameEffectSourceInstance;
		right: GameEffectSourceInstance;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

const readEffectSourceDistance = ({
	config,
	save,
	source,
	targetCell,
}: {
	config: GameConfig;
	save: GameSave;
	source: GameEffectSourceInstance;
	targetCell?: BoardCell;
}) => {
	const effect = config.effects[source.effectId];
	if (!targetCell || effect?.scope !== "local") return Number.POSITIVE_INFINITY;

	const sourceCell = readGameEffectSourceCell({
		save,
		sourceItemInstanceId: source.sourceItemInstanceId,
	});
	if (!sourceCell) return Number.POSITIVE_INFINITY;

	return readChebyshevDistance(sourceCell, targetCell);
};

const readEffectSourceCreatedAtMs = (source: GameEffectSourceInstance) =>
	source.sourceCreatedAtMs ?? source.startAtMs;

export const compareGameEffectSourceInstances = ({
	config,
	left,
	right,
	save,
	targetCell,
}: compareGameEffectSourceInstances.Props) => {
	const leftDistance = readEffectSourceDistance({
		config,
		save,
		source: left,
		targetCell,
	});
	const rightDistance = readEffectSourceDistance({
		config,
		save,
		source: right,
		targetCell,
	});
	if (leftDistance !== rightDistance) return rightDistance - leftDistance;

	const leftCreatedAtMs = readEffectSourceCreatedAtMs(left);
	const rightCreatedAtMs = readEffectSourceCreatedAtMs(right);
	if (leftCreatedAtMs !== rightCreatedAtMs) return leftCreatedAtMs - rightCreatedAtMs;

	return (
		left.sourceLocation.localeCompare(right.sourceLocation) ||
		left.sourceItemInstanceId.localeCompare(right.sourceItemInstanceId) ||
		left.effectId.localeCompare(right.effectId) ||
		left.sourceId.localeCompare(right.sourceId)
	);
};
