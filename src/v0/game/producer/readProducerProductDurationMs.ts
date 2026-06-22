import type { GameBlocker } from "~/v0/game/blockers/GameBlocker";
import { readGameBlockersDurationMultiplier } from "~/v0/game/blockers/readGameBlockerDurationMultiplier";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import { readProximityRequirementsDurationMultiplier } from "~/v0/game/requirements/readProximityRequirementsDurationMultiplier";

export namespace readProducerProductDurationMs {
	export interface Props {
		blockers: readonly GameBlocker[];
		product: GameConfig["products"][string];
		producerItemInstanceId: string;
		requirements: readonly GameRequirement[];
		save: GameSave;
	}
}

export const readProducerProductDurationMs = ({
	blockers,
	product,
	producerItemInstanceId,
	requirements,
	save,
}: readProducerProductDurationMs.Props) =>
	Math.max(
		1,
		Math.ceil(
			product.durationMs *
				readProximityRequirementsDurationMultiplier({
					requirements,
					save,
					targetItemInstanceId: producerItemInstanceId,
				}) *
				readGameBlockersDurationMultiplier({
					blockers,
					save,
					targetItemInstanceId: producerItemInstanceId,
				}),
		),
	);
