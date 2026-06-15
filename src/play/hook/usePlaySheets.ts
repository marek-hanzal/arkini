import { useCallback, useMemo, useState } from "react";
import type { ActiveSheet, BottomNavSheet } from "~/play/logic/playSheetTypes";
import { blurActiveElement } from "~/shared/util/blurActiveElement";

export namespace usePlaySheets {
	export interface State {
		activeSheet?: ActiveSheet;
		renderedSheet: ActiveSheet;
		selectedBoardItemId?: string;
		closeSheet(): void;
		openSheet(sheet: BottomNavSheet): void;
		openItem(boardItemId: string): void;
	}
}

export function usePlaySheets(): usePlaySheets.State {
	const [activeSheet, setActiveSheet] = useState<ActiveSheet | undefined>();
	const [renderedSheet, setRenderedSheet] = useState<ActiveSheet>("inventory");
	const [selectedBoardItemId, setSelectedBoardItemId] = useState<string | undefined>();

	const closeSheet = useCallback(() => {
		blurActiveElement();
		setActiveSheet(undefined);
		setSelectedBoardItemId(undefined);
	}, []);

	const openSheet = useCallback((sheet: BottomNavSheet) => {
		blurActiveElement();
		setSelectedBoardItemId(undefined);
		setRenderedSheet(sheet);
		setActiveSheet((current) => (current === sheet ? undefined : sheet));
	}, []);

	const openItem = useCallback((boardItemId: string) => {
		blurActiveElement();
		setSelectedBoardItemId(boardItemId);
		setRenderedSheet("item");
		setActiveSheet("item");
	}, []);

	return useMemo(
		() => ({
			activeSheet,
			renderedSheet,
			selectedBoardItemId: activeSheet === "item" ? selectedBoardItemId : undefined,
			closeSheet,
			openSheet,
			openItem,
		}),
		[
			activeSheet,
			closeSheet,
			openItem,
			openSheet,
			renderedSheet,
			selectedBoardItemId,
		],
	);
}
