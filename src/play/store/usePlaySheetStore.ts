import { create } from "zustand";
import type { BoardCell } from "~/board/boardIdentity";
import type { ActiveSheet, BottomNavSheet } from "~/play/ui/BottomNavigation";

export namespace usePlaySheetStore {
	export interface State {
		activeSheet?: ActiveSheet;
		renderedSheet: ActiveSheet;
		buildCell?: BoardCell;
		closeSheet(): void;
		openSheet(sheet: BottomNavSheet): void;
		openBuild(cell: BoardCell): void;
	}
}

export const usePlaySheetStore = create<usePlaySheetStore.State>((set) => ({
	renderedSheet: "inventory",
	closeSheet() {
		blurActiveElement();
		set({
			activeSheet: undefined,
		});
	},
	openSheet(sheet) {
		blurActiveElement();
		set((state) => ({
			renderedSheet: sheet,
			activeSheet: state.activeSheet === sheet ? undefined : sheet,
			buildCell: undefined,
		}));
	},
	openBuild(cell) {
		blurActiveElement();
		set({
			buildCell: cell,
			renderedSheet: "build",
			activeSheet: "build",
		});
	},
}));

function blurActiveElement() {
	const element = document.activeElement;
	if (element instanceof HTMLElement) element.blur();
}
