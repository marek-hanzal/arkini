import { readSpaceDestinationLabelFn } from "~/space/fn/readSpaceDestinationLabelFn";
import type { SpaceDestinationSchema } from "~/space/schema/SpaceDestinationSchema";
import { match } from "ts-pattern";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ArrowRight, PanelsTopLeft } from "lucide-react";
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
	const spaces = new Map<string, SpaceDestinationSchema.Type>();
	const templates = new Set<string>();
	for (const input of line.input) inputs.add(input.query.selector.itemUid);
	for (const rule of line.rules)
		for (const when of rule.when) inputs.add(when.query.selector.itemUid);
	for (const set of line.outcome?.set ?? []) {
		for (const rule of set.rules)
			for (const when of rule.when) outputs.add(when.query.selector.itemUid);
		for (const roll of set.roll) {
			const drops = readDraftRollOutcomesFn(roll);
			for (const outcome of drops) {
				match(outcome)
					.with(
						{
							type: "item",
						},
						({ itemUid }) => {
							outputs.add(itemUid);
						},
					)
					.with(
						{
							type: "space",
						},
						({ space }) => {
							spaces.set(
								typeof space === "object"
									? `inventory:${space.templateUid}`
									: String(space),
								space,
							);
						},
					)
					.with(
						{
							type: "template",
						},
						({ templateUid, space }) => {
							templates.add(templateUid);
							if (space !== undefined) spaces.set(String(space), space);
						},
					)
					.exhaustive();
			}
			for (const drop of drops)
				for (const rule of drop.rules)
					for (const when of rule.when) outputs.add(when.query.selector.itemUid);
		}
	}
	return {
		templates: [
			...templates,
		],
		spaces: [
			...spaces.values(),
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
		emptyLabel !== "" && <span className="text-xs text-subtle">({emptyLabel})</span>
	) : (
		<span className="flex min-w-0 flex-wrap items-center gap-1">
			{ids.map((id) => (
				<EditorItemThumbnail
					key={id}
					className="rounded-md"
					size="md"
					resourceUids={
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
	const project = useEditorProject();
	const { inputs, outputs, spaces, templates } = readItemSidesFn(line);
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
					{templates.map((uid) => (
						<span
							key={uid}
							className="flex items-center gap-1 text-xs text-subtle"
						>
							<PanelsTopLeft className="size-4" />
							{project.config.templates?.find((template) => template.uid === uid)
								?.title ?? uid}
						</span>
					))}
					{spaces.map((space) => (
						<span
							key={
								typeof space === "object" ? `inventory:${space.templateUid}` : space
							}
							className="text-xs text-subtle"
						>
							{readSpaceDestinationLabelFn(
								space,
								translator.textFn,
								project.config.templates,
							)}
						</span>
					))}
					<ItemImages
						ids={outputs}
						items={items}
						emptyLabel={
							spaces.length === 0 && templates.length === 0
								? translator.textFn("No outcomes")
								: ""
						}
					/>
				</span>
			</span>
		</EditorCollectionOption>
	);
};
