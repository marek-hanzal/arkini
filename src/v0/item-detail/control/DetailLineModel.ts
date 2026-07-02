import type { LineView } from "~/v0/board/view/LineViewSchema";
import type { DetailLineControl } from "~/v0/item-detail/control/DetailLineControl";

export interface DetailLineModel {
	control: DetailLineControl;
	line: LineView;
}
