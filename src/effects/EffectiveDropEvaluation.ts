import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { EffectiveChanceItemEntry, EffectiveDropEffectOutcome } from "~/effects/EffectiveLine";
import type { DropEffect } from "~/effects/RuntimeLineEffectTypes";

export type EffectiveDropEvaluation = {
	chanceItems: EffectiveChanceItemEntry[];
	dropEffects: EffectiveDropEffectOutcome[];
	enabled: boolean;
	visible: boolean;
};

export type EffectiveDropEffectApplicationProps = {
	chanceItems: EffectiveChanceItemEntry[];
	config: GameConfig;
	dropEffectId: string;
	dropEffectName: string;
	sourceDropId: string;
	effect: DropEffect;
	enabled: boolean;
	grantIds: ReadonlySet<string>;
	itemId: string;
	save: GameSave;
	targetCell?: BoardCell;
	visible: boolean;
};

export type EffectiveDropEffectApplicationPropsFor<Kind extends DropEffect["kind"]> = Omit<
	EffectiveDropEffectApplicationProps,
	"effect"
> & {
	effect: Extract<
		DropEffect,
		{
			kind: Kind;
		}
	>;
};
