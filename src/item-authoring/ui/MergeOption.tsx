import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Identifies a merge by its receiving item and separate target/source behavior. */
export const MergeOption = ({
	label,
	merge,
	target,
}: {
	readonly label: string;
	readonly merge: MergeSchema.Type;
	readonly target: ItemSchema.Type | undefined;
}) => {
	const translator = useTranslator();
	const effects = {
		keep: translator.textFn("Keep"),
		remove: translator.textFn("Remove"),
		spend: translator.textFn("Spend"),
		replace: translator.textFn("Replace"),
	};
	const actions = {
		use: translator.textFn("Use"),
		consume: translator.textFn("Consume"),
		spend: translator.textFn("Spend"),
	};
	return (
		<span
			className="flex min-w-0 flex-1 items-center gap-3"
			data-ui="EditorMergeOption"
		>
			<EditorItemSearchThumbnail item={target} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold text-foreground">
					{label}
				</span>
				<span className="mt-0.5 block text-xs text-subtle">
					{translator.textFn("Target effect")}:{" "}
					<strong className="font-bold text-foreground">{effects[merge.effect]}</strong>
					{" · "}
					{translator.textFn("Source action")}:{" "}
					<strong className="font-bold text-foreground">{actions[merge.action]}</strong>
				</span>
			</span>
		</span>
	);
};
