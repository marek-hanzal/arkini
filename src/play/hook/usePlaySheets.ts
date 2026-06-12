import { useState } from "react";
import type { BoardCell } from "~/board/boardIdentity";
import type { ActiveSheet, BottomNavSheet } from "~/play/ui/BottomNavigation";

export function usePlaySheets() {
	const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
	const [renderedSheet, setRenderedSheet] = useState<Exclude<ActiveSheet, null>>("inventory");
	const [buildCell, setBuildCell] = useState<BoardCell | null>(null);

	function blurActiveElement() {
		const element = document.activeElement;
		if (element instanceof HTMLElement) element.blur();
	}

	function closeSheet() {
		blurActiveElement();
		setActiveSheet(null);
	}

	function openSheet(sheet: BottomNavSheet) {
		blurActiveElement();
		setRenderedSheet(sheet);
		setActiveSheet((current) => (current === sheet ? null : sheet));
		setBuildCell(null);
	}

	function openBuild(cell: BoardCell) {
		blurActiveElement();
		setBuildCell(cell);
		setRenderedSheet("build");
		setActiveSheet("build");
	}

	return {
		activeSheet,
		renderedSheet,
		buildCell,
		closeSheet,
		openSheet,
		openBuild,
	};
}
