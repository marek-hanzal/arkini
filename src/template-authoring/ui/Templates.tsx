import { useState } from "react";
import { Plus, PanelsTopLeft, SearchX, ArrowRight } from "lucide-react";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorSectionPage } from "~/authoring-shell/ui/EditorSectionPage";
import { EditorHistoryBackButton } from "~/authoring-shell/ui/EditorHistoryBackButton";
import { EditorSectionBar } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorPageHelp } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { ButtonLink, PrimaryButtonLink } from "~/ui/ui/Button";
import { SearchInput } from "~/ui/ui/SearchInput";
import { Status } from "~/ui/ui/Status";
import { useTranslator } from "~/translation/ui/useTranslator";

export const Templates = () => {
	const project = useEditorProject();
	const translator = useTranslator();
	const [query, setQueryFn] = useState("");
	const allTemplates = project.config.templates ?? [];
	const templates = allTemplates.filter((template) =>
		`${template.title} ${template.uid}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
	);
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
				/>
			}
		>
			<div
				className="mx-auto grid max-w-[90rem] gap-4"
				data-ui="Templates"
			>
				{templates.length === 0 ? (
					<Status
						icon={allTemplates.length === 0 ? PanelsTopLeft : SearchX}
						size="large"
						variant="flat"
						title={
							allTemplates.length === 0
								? translator.textFn("No templates yet")
								: translator.textFn("No matching templates")
						}
						description={
							allTemplates.length === 0
								? translator.textFn(
										"Create a template to prepare a reusable board.",
									)
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
							<li key={template.uid}>
								<ButtonLink
									className="ak-list-row ak-list-row-interactive grid w-full min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left"
									to="/editor/$projectId/templates/$templateUid/detail/$sectionId"
									params={{
										projectId: project.projectId,
										templateUid: template.uid,
										sectionId: "general",
									}}
								>
									<PanelsTopLeft className="size-6 text-accent" />
									<span className="grid min-w-0 gap-1">
										<span className="truncate">{template.title}</span>
										<span className="text-sm font-normal text-muted">
											{template.width} × {template.height} ·{" "}
											{template.board.length} {translator.textFn("Items")}
										</span>
									</span>
									<ArrowRight className="size-4 text-muted" />
								</ButtonLink>
							</li>
						))}
					</ul>
				)}
			</div>
		</EditorSectionPage>
	);
};
