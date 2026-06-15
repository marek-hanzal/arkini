import type { FC } from "react";
import { useBottomNavigation } from "~/play/hook/useBottomNavigation";
import { BottomNavigation } from "~/play/ui/BottomNavigation";

export namespace BottomNavigationHost {
	export interface Props {}
}

export const BottomNavigationHost: FC<BottomNavigationHost.Props> = () => {
	const controller = useBottomNavigation();

	return (
		<BottomNavigation
			activeSheet={controller.activeSheet}
			inventoryDropTargetActive={controller.inventoryDropTargetActive}
			activeDropTargetNodeId={controller.activeDropTargetNodeId}
			onOpen={controller.onOpen}
		/>
	);
};
