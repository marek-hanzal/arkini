import { ChevronRight } from "lucide-react";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ButtonLink } from "~/ui/ui/Button";

/** Shares item-detail navigation and independent origin edit links across connection views. */
export const ItemConnectionRow = ({
	item,
	owner,
	origins,
}: {
	readonly item: ItemSchema.Type;
	readonly owner: ItemSchema.Type;
	readonly origins: readonly readItemConnectionFactsFn.Origin[];
}) => {
	const project = useEditorProject();
	return (
		<article
			className="ak-list-row ak-list-row-interactive flex min-h-16 min-w-0 items-center gap-4 p-3"
			data-ui="EditorItemConnectionsRow"
		>
			<EditorItemThumbnail
				className="pointer-events-none rounded-lg bg-[var(--ak-editor-background)]"
				imageClassName="p-0.5"
				resourceIds={item.artwork.default}
				size="sm"
			/>
			<div className="min-w-0 flex-1">
				<ButtonLink
					to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
					params={{
						projectId: project.projectId,
						itemUid: item.uid,
						sectionId: "identity",
					}}
					search={{}}
					className="min-h-0 min-w-0 justify-start border-0 bg-transparent p-0 text-left font-medium shadow-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent hover:text-accent active:bg-transparent"
				>
					{item.title}
				</ButtonLink>
				<div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
					{origins.map((origin, index) => (
						<ConnectionOrigin
							key={index}
							origin={origin}
							owner={owner}
						/>
					))}
				</div>
			</div>
			<ChevronRight className="pointer-events-none relative z-10 size-5 shrink-0 text-subtle" />
		</article>
	);
};

/** A compact authored path; the source belongs to the owner in either connection direction. */
const ConnectionOrigin = ({
	origin,
	owner,
}: {
	readonly origin: readItemConnectionFactsFn.Origin;
	readonly owner: ItemSchema.Type;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const source = origin.source;
	let label: string;
	switch (source.type) {
		case "line":
			label = `${translator.textFn("Product line")} ${source.lineIndex + 1}: ${source.title}`;
			break;
		case "merge":
			label = `${translator.textFn("Merge")} ${source.mergeIndex + 1}`;
			break;
		case "action":
			label = translator.textFn("Action");
			break;
		case "units":
			label = translator.textFn("Unit depletion");
			break;
		case "expiry":
			label = translator.textFn("Clock expiry");
			break;
		case "clock":
			label = translator.textFn("Clock");
			break;
	}
	const roleLabels = {
		input: "Input",
		condition: "Condition",
		output: "Output",
		replacement: "Replacement",
	} as const;
	const rollLabels = {
		guaranteed: translator.textFn("Guaranteed"),
		chance: translator.textFn("Chance"),
	};
	const roll = origin.roll;
	const sectionId =
		source.type === "line"
			? "production"
			: source.type === "merge"
				? "merges"
				: source.type === "expiry"
					? "clock"
					: source.type;
	return (
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid: owner.uid,
				sectionId,
			}}
			search={{
				lineId: source.type === "line" ? owner.lines?.[source.lineIndex]?.id : undefined,
				merge: source.type === "merge" ? source.mergeIndex : undefined,
				outputSet: origin.setIndex ?? roll?.setIndex,
				outputRoll: roll?.rollIndex,
				outputDrop: roll?.dropIndex,
				input: origin.inputIndex,
				rule: origin.condition?.ruleIndex,
				when: origin.condition?.whenIndex,
			}}
			data-ui="EditorItemConnectionOriginLink"
			className="relative z-10 inline min-h-0 border-0 bg-transparent p-0 text-left text-xs font-normal text-muted underline-offset-4 shadow-none hover:bg-transparent hover:text-accent hover:underline active:bg-transparent"
		>
			{label}
			{" · "}
			{translator.textFn(roleLabels[origin.role])}
			{origin.inputIndex === undefined ? null : ` ${origin.inputIndex + 1}`}
			{origin.setIndex === undefined ? null : (
				<>
					{" · "}
					{translator.textFn("Output set")} {origin.setIndex + 1}
				</>
			)}
			{roll === undefined ? null : (
				<>
					{" · "}
					{translator.textFn("Output set")} {roll.setIndex + 1}
					{" / "}
					{rollLabels[roll.rollType]} {translator.textFn("Roll")} {roll.rollIndex + 1}
				</>
			)}
			{origin.condition === undefined ? null : (
				<>
					{" · "}
					{translator.textFn("Rule")} {origin.condition.ruleIndex + 1}
					{" / "}
					{translator.textFn("Condition")} {origin.condition.whenIndex + 1}
				</>
			)}
		</ButtonLink>
	);
};
