import type { ItemId } from "../manifestId";
import type { UpgradeTierDefinition } from "~/v0/manifest/upgrade/UpgradeTierDefinition";
import { tier } from "./tier";

export namespace speedTiers {
	export interface Props {
		itemId: ItemId;
		costs: readonly UpgradeTierDefinition["cost"][number][];
	}
}

export const speedTiers = (props: speedTiers.Props): UpgradeTierDefinition[] => {
	const { itemId, costs } = props;

	return costs.map((entry) =>
		tier({
			cost: [
				entry,
			],
			effects: [
				{
					type: "producer.cooldown.add",
					itemId,
					ms: -100,
				},
			],
		}),
	);
};
