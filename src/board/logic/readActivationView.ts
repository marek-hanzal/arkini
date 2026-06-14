import type { DateService } from "~/date/context/DateServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ActivationView, BoardItemState } from "~/play/logic/playTypes";
import { applyProducerUpgradeEffects } from "~/upgrade/logic/applyProducerUpgradeEffects";
import type { OwnedUpgradeRow } from "~/upgrade/logic/readOwnedUpgradeEffects";
import { createInitialBoardState } from "./createInitialBoardState";

export namespace readActivationView {
	export interface Props {
		itemId: string;
		state: BoardItemState;
		date: DateService;
		gameConfig: GameConfigService;
		upgradeRows?: readonly OwnedUpgradeRow[];
	}
}

export const readActivationView = ({
	itemId,
	state,
	date,
	gameConfig,
	upgradeRows = [],
}: readActivationView.Props): ActivationView | undefined => {
	const baseActivation = gameConfig.getActivation(itemId);
	if (!baseActivation) return undefined;

	const activation =
		baseActivation.type === "producer"
			? applyProducerUpgradeEffects({
					gameConfig,
					producerItemId: itemId,
					producer: baseActivation,
					upgradeRows,
				})
			: baseActivation;

	const initial = createInitialBoardState(itemId, gameConfig).activation ?? {};
	const activationState = {
		...initial,
		...(state.activation ?? {}),
	};

	const cooldownUntil = activationState.cooldownUntil;
	const inventory = activationState.inventory ?? {};

	return {
		kind: activation.type,
		trigger: activation.trigger,
		cooldownMs: activation.type === "producer" ? activation.cooldownMs : undefined,
		cooldownUntil,
		cooldownUntilMs: cooldownUntil ? date.parseTimestampMs(cooldownUntil) : undefined,
		remainingCharges: activationState.remainingCharges,
		inputs: (activation.inputs ?? []).map((input) => ({
			itemId: input.itemId,
			quantity: input.quantity,
			capacity: input.capacity,
			stored: inventory[input.itemId] ?? 0,
		})),
	};
};
