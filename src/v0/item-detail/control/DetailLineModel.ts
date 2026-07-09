import type { LineView } from "~/board/view/LineViewSchema";
import type { DetailLineControl } from "~/item-detail/control/DetailLineControl";

export interface DetailLineModel {
	control: DetailLineControl;
	line: LineView;
}
