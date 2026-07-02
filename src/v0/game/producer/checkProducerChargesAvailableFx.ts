import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerRemainingCharges } from "~/v0/game/producer/readProducerRemainingCharges";
import { readProducerReservedChargeCost } from "~/v0/game/producer/readProducerReservedChargeCost";

export namespace checkProducerChargesAvailableFx {
	export interface Props {
		config: GameConfig;
		producerId: string;
		itemInstanceId: string;
		lineChargeCost: number;
		save: GameSave;
	}
}

export const checkProducerChargesAvailableFx = Effect.fn("checkProducerChargesAvailableFx")(
	function* ({
		config,
		producerId,
		itemInstanceId,
		lineChargeCost,
		save,
	}: checkProducerChargesAvailableFx.Props) {
		if (lineChargeCost <= 0) return;

		const remainingCharges = readProducerRemainingCharges({
			config,
			producerId,
			itemInstanceId,
			save,
		});
		if (remainingCharges === undefined) return;

		const reservedChargeCost = readProducerReservedChargeCost({
			config,
			itemInstanceId,
			save,
		});
		const availableCharges = remainingCharges - reservedChargeCost;

		if (availableCharges >= lineChargeCost) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_charges_depleted",
				`Producer item "${itemInstanceId}" has ${availableCharges} available charges but line requires ${lineChargeCost}.`,
			),
		);
	},
);
