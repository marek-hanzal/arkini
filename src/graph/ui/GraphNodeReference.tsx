import { match, P } from "ts-pattern";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import type { GraphNode } from "~/graph/type/GraphFacts";
import { useTranslator } from "~/translation/ui/useTranslator";
import { ButtonLink } from "~/ui/ui/Button";

/** Navigates canonical entities; missing references and spaces remain visible graph nodes. */
export const GraphNodeReference = ({
	id,
	node,
}: {
	readonly id: string;
	readonly node?: GraphNode;
}) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const item =
		id.startsWith("item:") && Object.hasOwn(project.config.items, id.slice(5))
			? project.config.items[id.slice(5)]
			: undefined;
	const template = id.startsWith("template:")
		? project.config.templates?.find((entry) => entry.uid === id.slice(9))
		: undefined;
	const className =
		"min-h-0 min-w-0 justify-start gap-2 border-0 bg-transparent p-0 text-left text-sm shadow-none hover:bg-transparent hover:text-accent";
	if (item !== undefined)
		return (
			<ButtonLink
				className={className}
				to="/editor/$projectId/editor/items/$itemUid/detail/$sectionId"
				params={{
					projectId: project.projectId,
					itemUid: item.uid,
					sectionId: "identity",
				}}
				search={{}}
			>
				<EditorItemThumbnail
					resourceUids={item.artwork.default}
					size="input"
				/>
				<span className="break-words">{item.title}</span>
			</ButtonLink>
		);
	if (template !== undefined)
		return (
			<ButtonLink
				className={className}
				to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
				params={{
					projectId: project.projectId,
					templateUid: template.uid,
					sectionId: "general",
				}}
			>
				<span>
					{translator.textFn("Template")} · {template.title}
				</span>
			</ButtonLink>
		);
	const space = id.startsWith("space:") ? Number(id.slice(6)) : undefined;
	if (
		id === "start" ||
		(space !== undefined &&
			(project.config.start.currentSpace === space ||
				project.config.start.spaces.some((entry) => entry.space === space)))
	)
		return (
			<ButtonLink
				className={className}
				to="/editor/$projectId/project/detail/$sectionId"
				params={{
					projectId: project.projectId,
					sectionId: "board",
				}}
				search={{
					space,
				}}
			>
				{id === "start"
					? translator.textFn("Starting configuration")
					: `${translator.textFn("Space")} ${space}`}
			</ButtonLink>
		);
	return (
		<span
			className="break-words text-sm"
			title={id}
		>
			{match({
				space,
				id,
			})
				.with(
					{
						space: P.nonNullable,
					},
					() => `${translator.textFn("Space")} ${id.slice(6)}`,
				)
				.with(
					{
						id: "start",
					},
					() => translator.textFn("Starting configuration"),
				)
				.otherwise(() => node?.title ?? id)}
			{node?.missing || id.startsWith("item:") || id.startsWith("template:")
				? ` · ${translator.textFn("Missing reference")}`
				: ""}
		</span>
	);
};
