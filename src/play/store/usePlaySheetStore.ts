import { create } from "zustand";
import type { ActiveSheet, BottomNavSheet } from "~/play/ui/BottomNavigation";

export namespace usePlaySheetStore {
	export interface State {
		activeSheet?: ActiveSheet;
		renderedSheet: ActiveSheet;
		selectedBoardItemId?: string;
		closeSheet(): void;
		openSheet(sheet: BottomNavSheet): void;
		openItem(boardItemId: string): void;
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
			selectedBoardItemId: undefined,
		}));
	},
	openItem(boardItemId) {
		blurActiveElement();
		set({
			selectedBoardItemId: boardItemId,
			renderedSheet: "item",
			activeSheet: "item",
		});
	},
}));

function blurActiveElement() {
	const element = document.activeElement;
	if (element instanceof HTMLElement) element.blur();
}
