import type { FC } from "react";
import { usePlaySheetHostController } from "~/play/hook/usePlaySheetHostController";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { PlaySheetContent } from "~/play/ui/PlaySheetContent";

export namespace PlaySheetHost {
	export interface Props {}
}

export const PlaySheetHost: FC<PlaySheetHost.Props> = () => {
	const controller = usePlaySheetHostController();

	return (
		<BottomSheet
			open={controller.open}
			onClose={controller.onClose}
		>
			<PlaySheetContent />
		</BottomSheet>
	);
};
