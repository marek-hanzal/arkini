import type { FC } from "react";
import { useSheetHost } from "~/play/hook/useSheetHost";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { PlaySheetContent } from "~/play/ui/PlaySheetContent";

export namespace PlaySheetHost {
	export interface Props {}
}

export const PlaySheetHost: FC<PlaySheetHost.Props> = () => {
	const controller = useSheetHost();

	return (
		<BottomSheet
			open={controller.open}
			onClose={controller.onClose}
		>
			<PlaySheetContent />
		</BottomSheet>
	);
};
