import { runEffect } from "~/play/logic/runEffect";
import { buyFx } from "~/upgrade/fx/buyFx";

export namespace buyUpgrade {
	export interface Props {
		upgradeId: string;
	}
}

export const buyUpgrade = ({ upgradeId }: buyUpgrade.Props) =>
	runEffect(
		buyFx({
			upgradeId,
		}),
	);
