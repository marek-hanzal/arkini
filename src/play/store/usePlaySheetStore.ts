import { create } from "zustand";
import type { BoardCell } from "~/board/boardIdentity";
import type { ActiveSheet, BottomNavSheet } from "~/play/ui/BottomNavigation";

export namespace usePlaySheetStore {
	export interface State {
		activeSheet: ActiveSheet;
		renderedSheet: Exclude<ActiveSheet, null>;
		buildCell: BoardCell | null;
		closeSheet(): void;
		openSheet(sheet: BottomNavSheet): void;
		openBuild(cell: BoardCell): void;
	}
}

export const usePlaySheetStore = create<usePlaySheetStore.State>((set) => ({
	activeSheet: null,
	renderedSheet: "inventory",
	buildCell: null,
	closeSheet() {
		blurActiveElement();
		set({
			activeSheet: null,
		});
	},
	openSheet(sheet) {
		blurActiveElement();
		set((state) => ({
			renderedSheet: sheet,
			activeSheet: state.activeSheet === sheet ? null : sheet,
			buildCell: null,
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
