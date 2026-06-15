import { runEffect } from "~/play/logic/runEffect";
import { buyFx } from "~/upgrade/fx/buyFx";

export namespace buy {
	export interface Props {
		upgradeId: string;
	}
}

export const buy = ({ upgradeId }: buy.Props) =>
	runEffect(
		buyFx({
			upgradeId,
		}),
	);
