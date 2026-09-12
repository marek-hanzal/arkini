import { Factory } from "lucide-react";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";

/** Keeps the item overview to two authored lines, with full output semantics. */
export const ProductionSummaryDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	return item.lines.length === 0 ? (
		<EditorRootCard dataUi="EditorItemProductionDisabledCard">
			<DisabledCapabilityDetail
				capability="production"
				itemUid={item.uid}
				title={translator.textFn("Item production empty title")}
				actionLabel={translator.textFn("Enable")}
				icon={Factory}
			/>
		</EditorRootCard>
	) : (
		<div
			className="grid content-start gap-3"
			data-ui="EditorItemProductionSummaryContent"
		>
			<EditorRootCard dataUi="EditorItemProductionSummaryCard">
				<FactList>
					<Fact
						label={translator.textFn("Status")}
						value={translator.textFn("Enabled")}
					/>
					<Fact
						label={translator.textFn("Line count")}
						value={item.lines.length}
					/>
				</FactList>
			</EditorRootCard>
			{item.lines.slice(0, 2).map((line) => (
				<EditorRootCard
					key={line.id}
					dataUi="EditorItemProductionOutputCard"
				>
					<OutputDetail
						output={line.output}
						title={line.title}
						emptyLabel={translator.textFn("No output")}
						description={translator.textFn(
							"This line can complete without producing an item. Configured output is resolved through its alternatives, rolls, and drop rules.",
						)}
					/>
				</EditorRootCard>
			))}
			{item.lines.length > 2 ? (
				<p className="text-right text-sm text-muted">(+{item.lines.length - 2})</p>
			) : null}
		</div>
	);
};
