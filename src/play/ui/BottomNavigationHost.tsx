import type { FC } from "react";
import { useBottomNavigationHostController } from "~/play/hook/useBottomNavigationHostController";
import { BottomNavigation } from "~/play/ui/BottomNavigation";

export namespace BottomNavigationHost {
	export interface Props {}
}

export const BottomNavigationHost: FC<BottomNavigationHost.Props> = () => {
	const controller = useBottomNavigationHostController();

	return (
		<BottomNavigation
			activeSheet={controller.activeSheet}
			inventoryDropTargetActive={controller.inventoryDropTargetActive}
			activeDropTargetNodeId={controller.activeDropTargetNodeId}
			onOpen={controller.onOpen}
		/>
	);
};
