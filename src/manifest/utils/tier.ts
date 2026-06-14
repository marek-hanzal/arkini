import type { UpgradeEffectDefinition, UpgradeTierDefinition } from "../upgrade";

export namespace tier {
	export interface Props {
		cost: readonly UpgradeTierDefinition["cost"][number][];
		effects: readonly UpgradeEffectDefinition[];
		durationMs?: number;
	}
}

export const tier = (props: tier.Props): UpgradeTierDefinition => {
	const { cost, effects, durationMs = 6000 } = props;

	return {
		cost,
		effects,
		durationMs,
	};
};
