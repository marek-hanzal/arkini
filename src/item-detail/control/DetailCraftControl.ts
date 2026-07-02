import type {
	DetailActionControl,
	DetailProgressActionControl,
} from "~/item-detail/control/DetailActionControl";

export interface DetailCraftControl {
	primaryAction: DetailProgressActionControl;
	statusLabel: string;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
