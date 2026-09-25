import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

/** Every literal destination reserves its address even when its rule never runs. */
export const readAuthoredSpaceIdsFn = (config: GameConfigSchema.Type): ReadonlySet<number> => {
	const spaces = new Set([
		config.start.currentSpace,
		...config.start.spaces.map(({ space }) => space),
	]);
	const collectOutcomeFn = (table: OutcomeTableSchema.Type | undefined) => {
		for (const set of table?.set ?? [])
			for (const roll of set.roll)
				for (const outcome of roll.outcome) {
					if (outcome.type === "space" && typeof outcome.space === "number")
						spaces.add(outcome.space);
				}
	};
	for (const item of Object.values(config.items)) {
		for (const line of item.lines) collectOutcomeFn(line.outcome);
		for (const merge of item.merge ?? []) {
			if (merge.action === "space" && typeof merge.space === "number")
				spaces.add(merge.space);
			collectOutcomeFn(merge.outcome);
		}
	}
	return spaces;
};
