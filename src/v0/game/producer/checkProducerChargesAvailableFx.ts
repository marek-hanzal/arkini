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
		producerItemInstanceId: string;
		lineChargeCost: number;
		save: GameSave;
	}
}

export const checkProducerChargesAvailableFx = Effect.fn("checkProducerChargesAvailableFx")(
	function* ({
		config,
		producerId,
		producerItemInstanceId,
		lineChargeCost,
		save,
	}: checkProducerChargesAvailableFx.Props) {
		if (lineChargeCost <= 0) return;

		const remainingCharges = readProducerRemainingCharges({
			config,
			producerId,
			producerItemInstanceId,
			save,
		});
		if (remainingCharges === undefined) return;

		const reservedChargeCost = readProducerReservedChargeCost({
			config,
			producerItemInstanceId,
			save,
		});
		const availableCharges = remainingCharges - reservedChargeCost;

		if (availableCharges >= lineChargeCost) return;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"producer_charges_depleted",
				`Producer item "${producerItemInstanceId}" has ${availableCharges} available charges but line requires ${lineChargeCost}.`,
			),
		);
	},
);
