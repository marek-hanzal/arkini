import { useCallback } from "react";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { UpgradeId } from "~/manifest/manifestId";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayUpgrades } from "~/play/hook/usePlayUpgrades";

export namespace useUpgradesSheetController {
	export interface Props {}
}

export const useUpgradesSheetController = (_props?: useUpgradesSheetController.Props) => {
	const upgrades = usePlayUpgrades();
	const items = usePlayItems();
	const buyUpgrade = useRunCommandMutation();
	const buy = useCallback(
		(upgradeId: UpgradeId) =>
			buyUpgrade.mutate({
				type: "upgrade.buy",
				upgradeId,
			}),
		[
			buyUpgrade.mutate,
		],
	);

	return {
		upgrades: upgrades.upgrades,
		items,
		buy,
		buyPending: buyUpgrade.isPending,
	};
};
