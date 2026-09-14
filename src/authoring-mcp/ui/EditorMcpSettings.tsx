import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";
import { ExternalLink, Save } from "lucide-react";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { PrimaryButton } from "~/ui/ui/Button";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorValueField } from "~/editor-control/ui/EditorValueField";
import { EditorMcpCopyableUrl } from "./EditorMcpCopyableUrl";

const editorMcpInputClassName =
	"w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-raised/60 disabled:text-muted disabled:placeholder:text-subtle";

interface EditorMcpSettingsProps {
	readonly section: "local" | "ngrok";
	readonly authtoken: string;
	readonly ngrokDomain: string;
	readonly onSaveNgrokFn: () => void;
	readonly onSavePortFn: () => void;
	readonly onSetAuthtokenFn: (value: string) => void;
	readonly onSetNgrokDomainFn: (value: string) => void;
	readonly onSetPortFn: (value: string) => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
	readonly port: string;
}

export const EditorMcpSettings = ({
	section,
	authtoken,
	ngrokDomain,
	onSaveNgrokFn,
	onSavePortFn,
	onSetAuthtokenFn,
	onSetNgrokDomainFn,
	onSetPortFn,
	overview,
	pending,
	port,
}: EditorMcpSettingsProps) => {
	const translator = useTranslator();
	const configuredDomain = overview.ngrokDomain;
	const remoteRunning = overview.remote.type === "ready" || overview.remote.type === "starting";
	const portDisabled =
		pending || overview.local.type === "ready" || overview.remote.type === "ready";
	const ngrokDisabled = pending || remoteRunning;
	const localUrl = `http://127.0.0.1:${port}/editor/mcp`;
	return (
		<div className="mx-auto w-full max-w-xl">
			{section === "local" ? (
				<EditorRootCard
					className="gap-3"
					dataUi="EditorMcpLocalSettingsCard"
				>
					<EditorFormSectionDivider title={translator.textFn("Local server")} />
					<EditorValueField
						as="div"
						label={translator.textFn("Port")}
						required
					>
						<div className="min-w-0">
							<input
								type="number"
								min={1_024}
								max={65_535}
								value={port}
								className={editorMcpInputClassName}
								disabled={portDisabled}
								onChange={(event) => onSetPortFn(event.currentTarget.value)}
							/>
						</div>
					</EditorValueField>
					<EditorMcpCopyableUrl url={localUrl} />
					<PrimaryButton
						className="justify-self-start gap-2"
						disabled={portDisabled}
						onClick={onSavePortFn}
					>
						<Save className="size-4" />
						<Tx label="Save" />
					</PrimaryButton>
				</EditorRootCard>
			) : (
				<EditorRootCard
					className="gap-3"
					dataUi="EditorMcpRemoteSettingsCard"
				>
					<EditorFormSectionDivider
						title={translator.textFn("ngrok tunnel")}
						action={
							<a
								href="https://ngrok.com/"
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-sm text-accent opacity-75 hover:opacity-100 hover:underline"
							>
								ngrok.com
								<ExternalLink className="size-3" />
							</a>
						}
					/>
					<EditorValueField
						label={translator.textFn("Development domain")}
						required
					>
						<input
							value={ngrokDomain}
							className={editorMcpInputClassName}
							disabled={ngrokDisabled}
							placeholder="your-assigned-name.ngrok-free.app"
							onChange={(event) => onSetNgrokDomainFn(event.currentTarget.value)}
						/>
					</EditorValueField>
					<EditorValueField
						label={translator.textFn("Authtoken")}
						required
					>
						<input
							type="password"
							value={authtoken}
							className={editorMcpInputClassName}
							disabled={ngrokDisabled}
							placeholder={
								configuredDomain === undefined
									? translator.textFn("Paste ngrok authtoken")
									: translator.textFn("Configured \u2014 paste to replace")
							}
							onChange={(event) => onSetAuthtokenFn(event.currentTarget.value)}
						/>
					</EditorValueField>
					<PrimaryButton
						className="justify-self-start gap-2"
						disabled={ngrokDisabled}
						onClick={onSaveNgrokFn}
					>
						<Save className="size-4" />
						<Tx label="Save" />
					</PrimaryButton>
				</EditorRootCard>
			)}
		</div>
	);
};
