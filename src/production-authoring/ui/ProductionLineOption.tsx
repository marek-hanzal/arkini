import { ArrowRight } from "lucide-react";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ProductionLineBadges } from "~/production-authoring/ui/ProductionLineBadges";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDraftRollOutcomesFn } from "~/production-authoring/fn/readDraftRollOutcomesFn";

/** Keeps authored order and deduplicates references independently on each side. */
const readItemSidesFn = (line: LineSchema.Type) => {
	const inputs = new Set<string>();
	const outputs = new Set<string>();
	const spaces = new Set<number>();
	for (const input of line.input) {
		switch (input.type) {
			case "materials":
			case "units":
				inputs.add(input.query.selector.itemId);
				break;
			case "simple":
				break;
		}
	}
	for (const rule of line.rules)
		for (const when of rule.when) inputs.add(when.query.selector.itemId);
	for (const set of line.outcome?.set ?? []) {
		for (const rule of set.rules)
			for (const when of rule.when) outputs.add(when.query.selector.itemId);
		for (const roll of set.roll) {
			const drops = readDraftRollOutcomesFn(roll);
			for (const outcome of drops) {
				if (outcome.type === "item") outputs.add(outcome.itemId);
				else spaces.add(outcome.space);
			}
			for (const drop of drops)
				for (const rule of drop.rules)
					for (const when of rule.when) outputs.add(when.query.selector.itemId);
		}
	}
	return {
		spaces: [
			...spaces,
		],
		inputs: [
			...inputs,
		],
		outputs: [
			...outputs,
		],
	};
};

const ItemImages = ({
	ids,
	items,
	emptyLabel,
}: {
	readonly ids: readonly string[];
	readonly items: GameConfigSchema.Type["items"];
	readonly emptyLabel: string;
}) =>
	ids.length === 0 ? (
		emptyLabel === "" ? null : (
			<span className="text-xs text-subtle">({emptyLabel})</span>
		)
	) : (
		<span className="flex min-w-0 flex-wrap items-center gap-1">
			{ids.map((id) => (
				<EditorItemThumbnail
					key={id}
					className="rounded-md"
					size="md"
					resourceIds={
						items[id]?.artwork.default ?? [
							"",
						]
					}
				/>
			))}
		</span>
	);

/** Identifies a line and previews its authored input/rule and outcome references. */
export const ProductionLineOption = ({
	line,
	label,
	items,
}: {
	readonly line: LineSchema.Type;
	readonly label: string;
	readonly items: GameConfigSchema.Type["items"];
}) => {
	const translator = useTranslator();
	const { inputs, outputs, spaces } = readItemSidesFn(line);
	return (
		<EditorCollectionOption
			label={label}
			details={<ProductionLineBadges line={line} />}
		>
			<span
				className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4"
				data-ui="ProductionLineOptionFlow"
			>
				<ItemImages
					ids={inputs}
					items={items}
					emptyLabel={translator.textFn("No inputs")}
				/>
				<ArrowRight className="size-4 shrink-0 text-subtle" />
				<span className="flex min-w-0 items-center justify-end gap-2">
					{spaces.map((space) => (
						<span
							key={space}
							className="text-xs text-subtle"
						>
							{translator.textFn("Space")} {space}
						</span>
					))}
					<ItemImages
						ids={outputs}
						items={items}
						emptyLabel={spaces.length === 0 ? translator.textFn("No outcomes") : ""}
					/>
				</span>
			</span>
		</EditorCollectionOption>
	);
};
