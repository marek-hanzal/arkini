import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { DetailProducerLineControl } from "~/v0/item-detail/control/DetailProducerLineControl";

export interface DetailProducerLineModel {
	control: DetailProducerLineControl;
	line: ProducerProductLineView;
}
