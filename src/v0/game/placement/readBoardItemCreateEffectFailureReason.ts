import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameEffectItemCreateMissingGrant } from "~/v0/game/effects/readGameEffectItemCreateMissingGrant";
import type { GamePlacementFailureReason } from "~/v0/game/placement/GamePlacementFailureReasonSchema";

type BoardItemCreateEffectFailureReason = Extract<
	GamePlacementFailureReason,
	"effect:missing-grant" | "effect:block-create"
>;

export namespace readBoardItemCreateEffectFailureReason {
	export interface Props {
		candidateCells: readonly BoardCell[];
		config: GameConfig;
		itemId: string;
		nowMs?: number;
		save: GameSave;
	}
}

export const readBoardItemCreateEffectFailureReason = ({
	candidateCells,
	config,
	itemId,
	nowMs,
	save,
}: readBoardItemCreateEffectFailureReason.Props): BoardItemCreateEffectFailureReason =>
	candidateCells.length > 0 &&
	candidateCells.every((targetCell) =>
		readGameEffectItemCreateMissingGrant({
			config,
			itemId,
			nowMs,
			save,
			targetCell,
		}),
	)
		? "effect:missing-grant"
		: "effect:block-create";
