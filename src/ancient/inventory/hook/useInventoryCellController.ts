import { useRef } from "react";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";

export namespace useInventoryCellController {
	export interface Props {
		invalid: boolean;
	}
}

export const useInventoryCellController = ({ invalid }: useInventoryCellController.Props) => {
	const cellRef = useRef<HTMLDivElement | null>(null);
	useMotionCellFeedback(cellRef, {
		invalid,
		imprint: false,
		success: false,
	});

	return {
		cellRef,
	};
};
