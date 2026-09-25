import { match } from "ts-pattern";
import { readTemplateDeleteBlockersFn } from "~/template-authoring/fn/readTemplateDeleteBlockersFn";
import { Status } from "~/ui/ui/Status";
import { TemplateSectionBar } from "~/template-authoring/ui/TemplateSectionBar";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useEditorEditShortcut } from "~/authoring-shell/ui/useEditorEditShortcut";
import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Copy, PanelsTopLeft, Pencil, ShieldCheck, ShieldAlert } from "lucide-react";
import { createId } from "@paralleldrive/cuid2";
import { copyTemplateFn } from "~/template-authoring/fn/copyTemplateFn";
import { BoardGrid } from "~/board-authoring/ui/BoardGrid";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { ButtonLink, DangerButton, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import type { Project } from "~/project-authoring/type/Project";

const TemplateDeleteBlockerLink = ({
	blocker,
	project,
}: {
	readonly blocker: GameDiagnosticSchema.Type;
	readonly project: Project;
}) => {
	const translator = useTranslator();
	const path = blocker.path;
	const className =
		"ak-list-row ak-list-row-interactive flex min-h-0 min-w-0 items-center justify-start gap-4 p-4 text-left";
	if (path[0] === "start" && path[1] === "spaces" && typeof path[2] === "number") {
		const assignment = project.config.start.spaces[path[2]];
		if (assignment !== undefined)
			return (
				<ButtonLink
					to="/editor/$projectId/project/form/$sectionId"
					params={{
						projectId: project.projectId,
						sectionId: "board",
					}}
					search={{
						space: assignment.space,
					}}
					className={className}
					data-ui="TemplateDeleteBlocker"
				>
					<span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-accent">
						<PanelsTopLeft className="size-5" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold">
							{translator.textFn("Project")} · {translator.textFn("Board")}
						</span>
						<span className="mt-1 block text-xs leading-5 text-muted">
							{translator.textFn("Space")} {assignment.space}
						</span>
					</span>
					<ChevronRight className="size-5 shrink-0 text-subtle" />
				</ButtonLink>
			);
	}
	if (path[0] !== "items" || typeof path[1] !== "string") return null;
	const item = project.config.items[path[1]];
	if (item === undefined) return null;
	const lineIndex = path[2] === "lines" && typeof path[3] === "number" ? path[3] : undefined;
	const mergeIndex = path[2] === "merge" && typeof path[3] === "number" ? path[3] : undefined;
	const sectionId =
		lineIndex !== undefined
			? "production"
			: mergeIndex !== undefined
				? "merges"
				: path[2] === "units"
					? "units"
					: "clock";
	const sectionLabel =
		sectionId === "production"
			? "Production"
			: sectionId === "merges"
				? "Merges"
				: sectionId === "units"
					? "Units"
					: "Clock";
	const readIndexFn = (name: string) => {
		const position = path.indexOf(name);
		const value = path[position + 1];
		return position >= 0 && typeof value === "number" ? value : undefined;
	};
	const outcomePosition = path.lastIndexOf("outcome");
	const outcomeValue = path[outcomePosition + 1];
	const outcomeSet = readIndexFn("set");
	const outcomeRoll = readIndexFn("roll");
	const outcomeIndex =
		outcomePosition >= 0 && typeof outcomeValue === "number" ? outcomeValue : undefined;
	const location = [
		...(lineIndex === undefined
			? []
			: [
					item.lines[lineIndex]?.title ||
						`${translator.textFn("Production line")} ${lineIndex + 1}`,
				]),
		...(mergeIndex === undefined
			? []
			: [
					`${translator.textFn("Merge")} ${mergeIndex + 1}`,
				]),
		...(outcomeSet === undefined
			? []
			: [
					`${translator.textFn("Outcome set")} ${outcomeSet + 1}`,
				]),
		...(outcomeRoll === undefined
			? []
			: [
					`${translator.textFn("Roll")} ${outcomeRoll + 1}`,
				]),
		...(outcomeIndex === undefined
			? []
			: [
					`${translator.textFn("Outcome")} ${outcomeIndex + 1}`,
				]),
		translator.textFn(path.includes("space") ? "Inventory" : "Template"),
	];
	return (
		<ButtonLink
			to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid: item.uid,
				sectionId,
			}}
			search={{
				lineUid: lineIndex === undefined ? undefined : item.lines[lineIndex]?.uid,
				merge: mergeIndex,
				outcomeSet,
				outcomeRoll,
				outcomeIndex,
			}}
			className={className}
			data-ui="TemplateDeleteBlocker"
		>
			<EditorItemThumbnail
				resourceUids={item.artwork.default}
				size="sm"
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold">
					{item.title || item.uid} · {translator.textFn(sectionLabel)}
				</span>
				<span className="mt-1 block text-xs leading-5 text-muted">
					{location.join(" › ")}
				</span>
			</span>
			<ChevronRight className="size-5 shrink-0 text-subtle" />
		</ButtonLink>
	);
};

export const TemplateDetail = ({
	templateUid,
	section,
}: {
	readonly templateUid: string;
	readonly section: "general" | "board" | "delete";
}) => {
	const project = useEditorProject();
	const template = project.config.templates?.find((entry) => entry.uid === templateUid);
	const translator = useTranslator();
	const references = readTemplateDeleteBlockersFn(project.config, templateUid);
	const navigateFn = useNavigate();
	const editActionRef = useEditorEditShortcut();

	const [pending, setPendingFn] = useState(false);
	const [error, setErrorFn] = useState<string>();
	const inFlight = useRef(false);
	const generation = useRef(0);
	useLayoutEffect(
		() => () => {
			generation.current += 1;
		},
		[],
	);
	const duplicateFn = async () => {
		if (inFlight.current || template === undefined) return;
		inFlight.current = true;
		setPendingFn(true);
		setErrorFn(undefined);
		const ownGeneration = generation.current;
		const copy = copyTemplateFn(template, createId());
		try {
			await RendererRuntime.runPromise(
				saveProjectConfigFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					config: {
						...project.config,
						templates: [
							...(project.config.templates ?? []),
							copy,
						],
					},
				}),
			);
			if (ownGeneration === generation.current)
				await navigateFn({
					to: "/editor/$projectId/templates/$templateUid/form/$sectionId",
					params: {
						projectId: project.projectId,
						templateUid: copy.uid,
						sectionId: "general",
					},
				});
		} catch (cause) {
			if (ownGeneration === generation.current) setErrorFn(String(cause));
		} finally {
			inFlight.current = false;
			if (ownGeneration === generation.current) setPendingFn(false);
		}
	};
	const deleteFn = async () => {
		if (inFlight.current || references.length > 0) return;
		inFlight.current = true;
		setPendingFn(true);
		setErrorFn(undefined);
		const ownGeneration = generation.current;
		try {
			await RendererRuntime.runPromise(
				saveProjectConfigFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					config: {
						...project.config,
						templates: (project.config.templates ?? []).filter(
							(entry) => entry.uid !== templateUid,
						),
					},
				}),
			);
			if (ownGeneration === generation.current)
				await navigateFn({
					to: "/editor/$projectId/templates",
					params: {
						projectId: project.projectId,
					},
				});
		} catch (cause) {
			if (ownGeneration === generation.current) setErrorFn(String(cause));
		} finally {
			inFlight.current = false;
			if (ownGeneration === generation.current) setPendingFn(false);
		}
	};
	if (template === undefined)
		return <p className="p-6">{translator.textFn("Template not found.")}</p>;
	return (
		<EditorSectionPage
			contentClassName={section === "delete" ? "mx-auto w-full" : "mx-auto w-3/4"}
			secondaryNavigation={
				<TemplateSectionBar
					actions={
						section === "delete" ? undefined : (
							<LinkButton
								className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
								cursorIntent={pending ? "progress" : undefined}
								data-ui="TemplateDuplicate"
								disabled={pending}
								onClick={() => void duplicateFn()}
							>
								<Copy className="size-4" />
								{translator.textFn("Copy")}
							</LinkButton>
						)
					}
					section={section}
					projectId={project.projectId}
					templateUid={templateUid}
					destination="detail"
				/>
			}
			header={
				<EditorSectionNavigation
					leading={
						<EditorHistoryBackButton
							to="/editor/$projectId/templates"
							params={{
								projectId: project.projectId,
							}}
						/>
					}
					title={<h1 className="text-xl font-semibold">{template.title}</h1>}
					action={
						section === "delete" ? undefined : (
							<div className="flex gap-2">
								<PrimaryButtonLink
									ref={editActionRef}
									className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
									to="/editor/$projectId/templates/$templateUid/form/$sectionId"
									params={{
										projectId: project.projectId,
										templateUid: template.uid,
										sectionId: section === "board" ? "board" : "general",
									}}
								>
									<Pencil className="mr-2 size-4" />
									{translator.textFn("Edit")}
								</PrimaryButtonLink>
							</div>
						)
					}
				/>
			}
		>
			<div
				className="mx-auto grid max-w-[90rem] gap-6"
				data-ui="TemplateDetail"
			>
				{error === undefined ? null : <p className="text-danger">{error}</p>}
				{section === "delete" ? (
					<section
						className="grid gap-3"
						data-ui="TemplateDeleteSection"
					>
						<Status
							dataUi="TemplateDeleteState"
							size="large"
							variant="flat"
							icon={references.length > 0 ? ShieldAlert : ShieldCheck}
							title={translator.textFn(
								references.length > 0
									? "This template cannot be deleted yet"
									: "This template can be deleted",
							)}
							description={
								references.length > 0
									? `${references.length} ${translator.textFn(
											references.length === 1
												? "reference must be removed first."
												: "references must be removed first.",
										)}`
									: translator.textFn(
											"Deleting this template removes its saved board layout from the project.",
										)
							}
							action={
								references.length > 0 ? undefined : (
									<DangerButton
										disabled={pending}
										onClick={() => void deleteFn()}
									>
										{translator.textFn("Delete")}
									</DangerButton>
								)
							}
						/>
						{references.length > 0 ? (
							<div
								className="ak-list grid gap-2"
								data-ui="TemplateDeleteBlockers"
							>
								{references.map((reference) => (
									<TemplateDeleteBlockerLink
										blocker={reference}
										key={reference.path.join(".")}
										project={project}
									/>
								))}
							</div>
						) : null}
					</section>
				) : null}
				{match(section)
					.with("general", () => (
						<EditorRootCard dataUi="TemplateGeneralDetail">
							<DetailSection title={translator.textFn("General")}>
								<DetailFacts columns={2}>
									<DetailFact
										label={translator.textFn("Title")}
										value={template.title}
									/>
									<DetailFact
										label="UID"
										value={<code>{template.uid}</code>}
									/>
									<DetailFact
										label={translator.textFn("Capacity")}
										value={`${template.width} × ${template.height} = ${template.width * template.height}`}
									/>
									<DetailFact
										label={translator.textFn("Items")}
										value={template.board.length}
									/>
								</DetailFacts>
							</DetailSection>
						</EditorRootCard>
					))
					.with("board", () => (
						<EditorRootCard dataUi="TemplateBoardDetail">
							<BoardGrid
								mode="detail"
								cells={template.board}
								width={template.width}
								height={template.height}
								items={project.config.items}
								projectId={project.projectId}
							/>
						</EditorRootCard>
					))
					.with("delete", () => null)
					.exhaustive()}
			</div>
		</EditorSectionPage>
	);
};
