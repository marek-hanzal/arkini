import type { UpgradeId } from "../manifestId";
import type { UpgradeDefinition, UpgradeTierDefinition } from "../upgrade";

export namespace upgrade {
	export interface Props {
		id: UpgradeId;
		code: string;
		name: string;
		description: string;
		sort: number;
		tiers: readonly UpgradeTierDefinition[];
	}
}

export const upgrade = (props: upgrade.Props): UpgradeDefinition => {
	const { id, code, name, description, sort, tiers } = props;

	return {
		id,
		code,
		name,
		description,
		sort,
		tiers,
	};
};
