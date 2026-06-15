import type { ItemId } from "../manifestId";
import type { UpgradeTierDefinition } from "~/v0/manifest/upgrade/UpgradeTierDefinition";

export namespace cost {
	export interface Props {
		itemId: ItemId;
		quantity: number;
	}
}

export const cost = (props: cost.Props): UpgradeTierDefinition["cost"][number] => {
	const { itemId, quantity } = props;

	return {
		itemId,
		quantity,
	};
};
