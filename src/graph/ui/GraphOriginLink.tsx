import { ArrowUpRight } from "lucide-react";
import { match } from "ts-pattern";
import type { GraphEdge, GraphOperation } from "~/graph/type/GraphFacts";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ButtonLink } from "~/ui/ui/Button";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Authored occurrence coordinates become an Editor destination, never a printed config path. */
export const GraphOriginLink = ({
	edge,
	operation,
}: {
	readonly edge: GraphEdge;
	readonly operation?: GraphOperation;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const annotations = edge.annotations;
	const className =
		"min-h-0 min-w-0 justify-start border-0 bg-transparent p-0 text-left text-xs text-muted shadow-none hover:bg-transparent hover:text-accent";
	if (operation !== undefined) {
		const ownerUid = operation.owner.slice(5);
		const owner = Object.hasOwn(project.config.items, ownerUid)
			? project.config.items[ownerUid]
			: undefined;
		if (owner === undefined) return null;
		const sectionId = match(operation)
			.with(
				{
					kind: "line",
				},
				({ data }) =>
					data.trigger === LineTriggerEnumSchema.enum.manual
						? ("production" as const)
						: ("automation" as const),
			)
			.with(
				{
					kind: "merge",
				},
				() => "merges" as const,
			)
			.with(
				{
					kind: "clock",
				},
				() => "clock" as const,
			)
			.with(
				{
					kind: "depletion",
				},
				() => "identity" as const,
			)
			.exhaustive();
		const location = [
			owner.title,
			match(operation)
				.with(
					{
						kind: "line",
					},
					({ data }) => data.title,
				)
				.with(
					{
						kind: "merge",
					},
					({ source }) => `${translator.textFn("Merge")} ${Number(source[3]) + 1}`,
				)
				.with(
					{
						kind: "clock",
					},
					() => translator.textFn("Clock"),
				)
				.with(
					{
						kind: "depletion",
					},
					() => translator.textFn("Units"),
				)
				.exhaustive(),
		];
		for (const [label, index] of [
			[
				"Input",
				annotations.inputIndex,
			],
			[
				"Output set",
				annotations.setIndex,
			],
			[
				"Roll",
				annotations.rollIndex,
			],
			[
				"Outcome",
				annotations.outcomeIndex,
			],
			[
				"Rule",
				annotations.ruleIndex,
			],
			[
				"Condition",
				annotations.whenIndex,
			],
		] as const)
			if (index !== undefined) location.push(`${translator.textFn(label)} ${index + 1}`);
		return (
			<ButtonLink
				className={className}
				data-ui="EditorGraphOriginLink"
				to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
				params={{
					projectId: project.projectId,
					itemUid: owner.uid,
					sectionId,
				}}
				search={{
					lineUid: operation.kind === "line" ? operation.data.uid : undefined,
					merge: operation.kind === "merge" ? Number(operation.source[3]) : undefined,
					input: annotations.inputIndex,
					rule: annotations.ruleIndex,
					when: annotations.whenIndex,
					outcomeSet: annotations.setIndex,
					outcomeRoll: annotations.rollIndex,
					outcomeIndex: annotations.outcomeIndex,
				}}
			>
				<span>{location.join(" › ")}</span>
				<ArrowUpRight className="size-3 shrink-0" />
			</ButtonLink>
		);
	}
	if (edge.kind === "template-item") {
		const template = project.config.templates?.find(
			(entry) => `template:${entry.uid}` === edge.from,
		);
		if (template === undefined) return null;
		return (
			<ButtonLink
				className={className}
				data-ui="EditorGraphOriginLink"
				to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
				params={{
					projectId: project.projectId,
					templateUid: template.uid,
					sectionId: "board",
				}}
			>
				<span>
					{template.title} › {translator.textFn("Board")}
					{annotations.position === undefined
						? ""
						: ` · (${annotations.position.x}, ${annotations.position.y})`}
				</span>
				<ArrowUpRight className="size-3 shrink-0" />
			</ButtonLink>
		);
	}
	if (edge.kind === "start-space" || edge.kind === "start-template")
		return (
			<ButtonLink
				className={className}
				data-ui="EditorGraphOriginLink"
				to="/editor/$projectId/project/form/$sectionId"
				params={{
					projectId: project.projectId,
					sectionId: "board",
				}}
			>
				<span>
					{translator.textFn("Starting configuration")} ›{" "}
					{translator.textFn(
						edge.source[1] === "currentSpace" ? "Current space" : "Spaces",
					)}
				</span>
				<ArrowUpRight className="size-3 shrink-0" />
			</ButtonLink>
		);
	return null;
};
