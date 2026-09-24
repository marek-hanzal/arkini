import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createId } from "@paralleldrive/cuid2";
import { Plus, PanelsTopLeft, PanelTopDashed, SearchX, ArrowRight, Copy } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import {
	EditorSectionBar,
	EditorSectionShortcutNavigation,
} from "~/authoring-shell/ui/EditorSectionBar";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { SearchInput } from "~/ui/ui/SearchInput";
import { Status } from "~/ui/ui/Status";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readItemTemplateReferencesFn } from "~/game-config-validation/fn/readItemTemplateReferencesFn";
import { copyTemplateFn } from "~/template-authoring/fn/copyTemplateFn";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";

const templateFilters = [
	{
		icon: PanelsTopLeft,
		label: "All",
		value: "all",
		shortcut: "a",
	},
	{
		icon: PanelTopDashed,
		label: "Unused",
		value: "unused",
		shortcut: "u",
	},
] as const;

export const Templates = () => {
	const project = useEditorProject();
	const translator = useTranslator();
	const navigateFn = useNavigate();
	const [query, setQueryFn] = useState("");
	const [filter, setFilterFn] = useState<"all" | "unused">("all");
	const [copyPendingUid, setCopyPendingUidFn] = useState<string>();
	const [copyError, setCopyErrorFn] = useState<string>();
	const inFlight = useRef(false);
	const generation = useRef(0);
	useLayoutEffect(
		() => () => {
			generation.current += 1;
		},
		[],
	);
	const allTemplates = project.config.templates ?? [];
	const usedTemplateUids = new Set(project.config.start.spaces.map((entry) => entry.templateUid));
	for (const item of Object.values(project.config.items))
		for (const reference of readItemTemplateReferencesFn(item))
			usedTemplateUids.add(reference.templateUid);
	const templates = allTemplates
		.filter(
			(template) =>
				(filter === "all" || !usedTemplateUids.has(template.uid)) &&
				`${template.title} ${template.uid}`
					.toLocaleLowerCase()
					.includes(query.toLocaleLowerCase()),
		)
		.sort(
			(a, b) =>
				a.title.localeCompare(b.title, undefined, {
					sensitivity: "base",
				}) || a.uid.localeCompare(b.uid),
		);
	const copyFn = async (template: TemplateSchema.Type) => {
		if (inFlight.current) return;
		inFlight.current = true;
		setCopyPendingUidFn(template.uid);
		setCopyErrorFn(undefined);
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
							...allTemplates,
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
			if (ownGeneration === generation.current) setCopyErrorFn(String(cause));
		} finally {
			inFlight.current = false;
			if (ownGeneration === generation.current) setCopyPendingUidFn(undefined);
		}
	};
	return (
		<EditorSectionPage
			header={
				<header className="flex min-w-0 flex-wrap items-center gap-2">
					<EditorHistoryBackButton
						to="/editor/$projectId/editor/items/list"
						params={{
							projectId: project.projectId,
						}}
					/>
					<SearchInput
						value={query}
						onValueChangeFn={setQueryFn}
						containerClassName="min-w-64 flex-1"
						className="h-10 min-h-10 w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 text-sm text-foreground outline-none placeholder:text-muted"
						data-ui="TemplateSearch"
						placeholder={`${translator.textFn("Search templates...")} (${allTemplates.length})`}
					/>
					<PrimaryButtonLink
						className="h-10 min-h-10 gap-2 px-3 py-2 text-sm"
						to="/editor/$projectId/templates/$templateUid/form/$sectionId"
						params={{
							projectId: project.projectId,
							templateUid: "new",
							sectionId: "general",
						}}
					>
						<Plus className="size-4" />
						{translator.textFn("New template")}
					</PrimaryButtonLink>
				</header>
			}
			secondaryNavigation={
				<EditorSectionBar
					help={
						<EditorPageHelp
							title={translator.textFn("Templates")}
							content={<Mx label="Templates help" />}
						/>
					}
				>
					<EditorSectionShortcutNavigation
						dataUi="TemplateFilter"
						onChangeFn={setFilterFn}
						options={templateFilters.map((option) => ({
							...option,
							label: translator.textFn(option.label),
						}))}
						value={filter}
					/>
				</EditorSectionBar>
			}
		>
			<div
				className="mx-auto grid max-w-[90rem] gap-4"
				data-ui="Templates"
			>
				{copyError === undefined ? null : <p className="text-danger">{copyError}</p>}
				{templates.length === 0 ? (
					<Status
						icon={allTemplates.length === 0 ? PanelsTopLeft : SearchX}
						size="large"
						variant="flat"
						title={
							allTemplates.length === 0
								? translator.textFn("No templates yet")
								: filter === "unused" && query.trim() === ""
									? translator.textFn("No unused templates")
									: translator.textFn("No matching templates")
						}
						description={
							allTemplates.length === 0
								? translator.textFn(
										"Create a template to prepare a reusable board.",
									)
								: filter === "unused" && query.trim() === ""
									? translator.textFn("Every template is in use.")
									: translator.textFn("Try a different search.")
						}
						action={
							allTemplates.length === 0 ? (
								<PrimaryButtonLink
									to="/editor/$projectId/templates/$templateUid/form/$sectionId"
									params={{
										projectId: project.projectId,
										templateUid: "new",
										sectionId: "general",
									}}
								>
									<Plus className="mr-2 size-4" />
									{translator.textFn("New template")}
								</PrimaryButtonLink>
							) : undefined
						}
					/>
				) : (
					<ul
						className="ak-list grid gap-2"
						data-ui="TemplateList"
					>
						{templates.map((template) => (
							<li
								key={template.uid}
								className="ak-list-row ak-list-row-interactive relative grid w-full min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left"
							>
								<PanelsTopLeft className="size-6 text-accent" />
								<span className="grid min-w-0 gap-1">
									<ButtonLink
										className="min-h-0 w-fit max-w-full justify-start border-0 bg-transparent p-0 text-left shadow-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent"
										to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
										params={{
											projectId: project.projectId,
											templateUid: template.uid,
											sectionId: "general",
										}}
									>
										<span className="truncate">{template.title}</span>
									</ButtonLink>
									<span className="pointer-events-none relative z-10 flex flex-wrap items-center gap-1.5 text-sm font-normal text-muted">
										<LinkButton
											className="pointer-events-auto inline-flex items-center gap-1 text-sm"
											cursorIntent={
												copyPendingUid === undefined
													? undefined
													: "progress"
											}
											data-ui="TemplateListCopy"
											disabled={copyPendingUid !== undefined}
											onClick={() => void copyFn(template)}
										>
											<Copy className="size-3.5" />
											{translator.textFn("Copy")}
										</LinkButton>
										<span>·</span>
										<span>
											{template.width} × {template.height}
										</span>
										<span>·</span>
										<span>
											{template.board.length} {translator.textFn("Items")}
										</span>
									</span>
								</span>
								<ArrowRight className="size-4 text-muted" />
							</li>
						))}
					</ul>
				)}
			</div>
		</EditorSectionPage>
	);
};
