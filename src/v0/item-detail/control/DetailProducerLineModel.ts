import type { ProducerLineView } from "~/v0/board/view/ProducerLineViewSchema";
import type { DetailProducerLineControl } from "~/v0/item-detail/control/DetailProducerLineControl";

export interface DetailProducerLineModel {
	control: DetailProducerLineControl;
	line: ProducerLineView;
}
