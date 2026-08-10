import type { EditorItem, EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { DetailFact, DetailSection } from "~/ui/item/editor/EditorItemDetailDefinition";
import { OutputDetail } from "~/ui/item/editor/EditorItemOutputDetail";
import { EditorProductionLineDetail } from "~/ui/item/editor/EditorProductionLineDetail";
import { Status } from "~/ui/status/Status";

const readProductionLines = (item: EditorItem): ReadonlyArray<EditorLine> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		default:
			return [];
	}
};

/** Dispatches production-capable lines, temporary lifetime, or the disabled contract. */
export const EditorItemProductionDetail = ({ item }: { readonly item: EditorItem }) => {
	const lines = readProductionLines(item);
	if (lines.length > 0)
		return (
			<div className="ak-list grid gap-3">
				{lines.map((line) => (
					<EditorProductionLineDetail
						key={line.id}
						line={line}
					/>
				))}
			</div>
		);
	if (!("durationMs" in item))
		return (
			<Status
				dataUi="EditorProductionLinesDisabledStatus"
				description="This item has no production lines, so it cannot run production jobs or transform inputs into outputs. Configure a production-capable item to add that behavior."
				icon="icon-[lucide--factory]"
				title="Production lines are disabled"
			/>
		);
	return (
		<div className="grid gap-6">
			<DetailSection title="Lifetime">
				<DetailFact
					label="Duration"
					value={`${item.durationMs} ms`}
				/>
			</DetailSection>
			<DetailSection title="Expiry output">
				<OutputDetail output={item.output} />
			</DetailSection>
		</div>
	);
};
