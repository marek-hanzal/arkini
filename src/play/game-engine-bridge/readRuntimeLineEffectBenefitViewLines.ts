import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameLineDefinition } from "~/config/GameItemCapabilities";
import { readRuntimeEffectBenefitLines } from "~/play/game-engine-bridge/readRuntimeEffectOperationSummary";

export namespace readRuntimeLineEffectBenefitViewLines {
	export interface Props {
		config: GameConfig;
		line: GameLineDefinition;
	}
}

export const readRuntimeLineEffectBenefitViewLines = ({
	config,
	line,
}: readRuntimeLineEffectBenefitViewLines.Props) =>
	line.effect
		? readRuntimeEffectBenefitLines({
				config,
				effectId: line.effect.id,
			})
		: undefined;
