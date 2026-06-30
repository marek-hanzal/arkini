import type {
	DetailActionControl,
	DetailProgressActionControl,
} from "~/v1/item-detail/control/DetailActionControl";

export interface DetailProducerLineControl {
	defaultAction?: DetailActionControl;
	primaryAction: DetailProgressActionControl;
	withdrawInputActionsByItemId: Readonly<Record<string, DetailActionControl | undefined>>;
}
