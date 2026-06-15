import { Effect } from "effect";
import { activationLabel } from "~/v0/activation/logic/activationLabel";
import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { ActivationDefinition } from "~/v0/manifest/activation/ActivationDefinition";
import { GameActionError } from "~/v0/play/action/GameActionError";

export namespace assertActivationStoredInputsFx {
	export interface Props {
		activation: ActivationDefinition;
		gameConfig: GameConfigService;
		steps: number;
		storedInputs: ReadonlyMap<ItemId, number>;
	}
}

export const assertActivationStoredInputsFx = Effect.fn("assertActivationStoredInputsFx")(
	function* ({
		activation,
		gameConfig,
		steps,
		storedInputs,
	}: assertActivationStoredInputsFx.Props) {
		for (const requirement of activation.requirements ?? []) {
			const stored = storedInputs.get(requirement.itemId) ?? 0;
			if (stored < requirement.quantity) {
				const name = gameConfig.getItem(requirement.itemId)?.name ?? requirement.itemId;
				return yield* Effect.fail(
					new GameActionError(`${activationLabel(activation.type)} requires ${name}.`),
				);
			}
		}

		for (const required of activation.inputs ?? []) {
			const needed = required.quantity * steps;
			const stored = storedInputs.get(required.itemId) ?? 0;
			if (stored < needed) {
				const name = gameConfig.getItem(required.itemId)?.name ?? required.itemId;
				return yield* Effect.fail(
					new GameActionError(`${activationLabel(activation.type)} needs ${name}.`),
				);
			}
		}
	},
);
