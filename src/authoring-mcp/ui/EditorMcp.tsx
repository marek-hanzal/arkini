import { Check, Copy, RefreshCw } from "lucide-react";
import { match } from "ts-pattern";
import type { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

import { Button, ButtonLink, DangerButton, PrimaryButton } from "~/ui/button/Button";
import { EditorSectionNavigation } from "~/authoring-shell/ui/EditorSectionNavigation";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
	EditorSectionTabs,
} from "~/authoring-shell/ui/EditorSectionTabs";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorMcpSections, type EditorMcpSectionId } from "./EditorMcpSections";
import { type EditorMcpController, useEditorMcpController } from "./useEditorMcpController";

const statusClassNames = {
	muted: "text-sm text-muted",
	danger: "text-sm text-danger",
	success: "text-sm text-success",
} as const;

type EditorMcpStatusTone = keyof typeof statusClassNames;

const editorMcpInputClassName =
	"w-full rounded-lg border border-line bg-surface px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

const EditorMcpStatus = ({
	message,
	tone = "muted",
}: {
	readonly message: string;
	readonly tone?: EditorMcpStatusTone;
}) => <p className={statusClassNames[tone]}>{message}</p>;

const EditorMcpCopyButton = ({
	copied,
	onCopy,
	title,
}: {
	readonly copied: boolean;
	readonly onCopy: () => void;
	readonly title: string;
}) => {
	const Icon = copied ? Check : Copy;
	return (
		<button
			type="button"
			className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-current opacity-65 transition-opacity hover:opacity-100"
			title={copied ? "Copied" : title}
			onClick={onCopy}
		>
			<Icon className="size-4" />
		</button>
	);
};

const EditorMcpCopyableUrl = ({
	copied,
	label,
	onCopy,
	url,
}: {
	readonly copied: boolean;
	readonly label: string;
	readonly onCopy: () => void;
	readonly url: string;
}) => (
	<div className="flex min-w-0 items-center gap-1 text-sm text-success">
		<span className="min-w-0 break-all">
			{label}: {url}
		</span>
		<EditorMcpCopyButton
			copied={copied}
			onCopy={onCopy}
			title="Copy URL"
		/>
	</div>
);

const readLocalStatus = (
	status: EditorMcpOverviewSchema.Type["local"] | undefined,
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ port }) => ({
				message: `Running on port ${port}.`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

const readRemoteStatus = (
	status: EditorMcpOverviewSchema.Type["remote"] | undefined,
): {
	readonly message: string;
	readonly tone: EditorMcpStatusTone;
} =>
	match(status)
		.with(
			{
				type: "ready",
			},
			({ url }) => ({
				message: `Running at ${url}`,
				tone: "success" as const,
			}),
		)
		.with(
			{
				type: "starting",
			},
			() => ({
				message: "Starting tunnel and checking OAuth…",
				tone: "muted" as const,
			}),
		)
		.with(
			{
				type: "unavailable",
			},
			({ message }) => ({
				message,
				tone: "danger" as const,
			}),
		)
		.otherwise(() => ({
			message: "Stopped.",
			tone: "muted" as const,
		}));

const EditorMcpServerSettings = ({ controller }: { readonly controller: EditorMcpController }) => {
	const local = controller.overview?.local;
	const remote = controller.overview?.remote;
	const localStatus = readLocalStatus(local);
	const remoteStatus = readRemoteStatus(remote);
	const localUrl =
		local?.type === "ready" ? `http://127.0.0.1:${local.port}/editor/mcp` : undefined;
	const remotePasswordCopyKey = `remote-password:${controller.remotePassword ?? ""}`;
	return (
		<div className="grid gap-4">
			{controller.remotePassword === undefined ? null : (
				<div
					className="grid gap-3 rounded-xl border border-accent bg-accent/10 p-5"
					data-ui="EditorMcpRemotePassword"
				>
					<h2 className="font-semibold">Remote password</h2>
					<p className="text-sm text-muted">
						Enter this password on the Arkini authorization page when a Remote MCP
						client connects. Generating a new password stops Remote MCP and disconnects
						existing clients.
					</p>
					<div className="flex min-w-0 items-stretch gap-2">
						<div className="relative min-w-0 flex-1">
							<input
								readOnly
								value={controller.remotePassword}
								className={`${editorMcpInputClassName} h-full min-w-0 pr-10`}
							/>
							<div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted">
								<EditorMcpCopyButton
									copied={controller.copied === remotePasswordCopyKey}
									onCopy={() =>
										void controller.copy(
											remotePasswordCopyKey,
											controller.remotePassword ?? "",
										)
									}
									title="Copy password"
								/>
							</div>
						</div>
						<DangerButton
							className="shrink-0 gap-2"
							disabled={controller.pending}
							onClick={controller.resetAuth}
						>
							<RefreshCw className="size-4" />
							Refresh
						</DangerButton>
					</div>
				</div>
			)}
			<div className="ak-list-row grid gap-5 rounded-xl border border-line p-5">
				<div className="grid gap-3">
					<div>
						<h2 className="font-semibold">Local MCP</h2>
						<p className="mt-1 text-sm text-muted">
							Open only on loopback for Codex and other local tools.
						</p>
					</div>
					{local?.type === "ready" ? (
						<Button
							disabled={controller.pending}
							onClick={controller.stopLocal}
						>
							Stop Local MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={controller.pending}
							onClick={controller.startLocal}
						>
							Start Local MCP
						</PrimaryButton>
					)}
					{localUrl === undefined ? (
						<EditorMcpStatus
							message={localStatus.message}
							tone={localStatus.tone}
						/>
					) : (
						<EditorMcpCopyableUrl
							copied={controller.copied === "local-url"}
							label="Running at"
							onCopy={() => void controller.copy("local-url", localUrl)}
							url={localUrl}
						/>
					)}
				</div>
				<div className="grid gap-3 border-t border-line pt-5">
					<div>
						<h2 className="font-semibold">Remote MCP</h2>
						<p className="mt-1 text-sm text-muted">
							OAuth-protected public access through the configured ngrok tunnel.
						</p>
					</div>
					{remote?.type === "ready" ? (
						<Button
							disabled={controller.pending}
							onClick={controller.stopRemote}
						>
							Stop Remote MCP
						</Button>
					) : (
						<PrimaryButton
							disabled={
								controller.pending || controller.overview?.ngrokDomain === undefined
							}
							onClick={controller.startRemote}
						>
							Start Remote MCP
						</PrimaryButton>
					)}
					{remote?.type === "ready" ? (
						<EditorMcpCopyableUrl
							copied={controller.copied === "remote-url"}
							label="Running at"
							onCopy={() => void controller.copy("remote-url", remote.url)}
							url={remote.url}
						/>
					) : (
						<EditorMcpStatus
							message={remoteStatus.message}
							tone={remoteStatus.tone}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

const EditorMcpSettings = ({ controller }: { readonly controller: EditorMcpController }) => {
	const configuredDomain = controller.overview?.ngrokDomain;
	const remoteRunning =
		controller.overview?.remote.type === "ready" ||
		controller.overview?.remote.type === "starting";
	const portDisabled =
		controller.pending ||
		controller.overview?.local.type === "ready" ||
		controller.overview?.remote.type === "ready";
	const ngrokDisabled = controller.pending || remoteRunning;
	const localUrl = `http://127.0.0.1:${controller.port}/editor/mcp`;
	return (
		<div className="grid gap-4">
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">Local server</h2>
					<p className="mt-1 text-sm text-muted">
						The open local endpoint is intended for trusted tools running on this
						computer.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Port</span>
					<input
						type="number"
						min={1_024}
						max={65_535}
						value={controller.port}
						className={editorMcpInputClassName}
						disabled={portDisabled}
						onChange={(event) => controller.setPort(event.currentTarget.value)}
					/>
				</label>
				<Button
					className="justify-self-start"
					disabled={controller.pending}
					onClick={controller.savePort}
				>
					Save port
				</Button>
				<EditorMcpCopyableUrl
					copied={controller.copied === "local-url"}
					label="Local endpoint"
					onCopy={() => void controller.copy("local-url", localUrl)}
					url={localUrl}
				/>
			</div>
			<div className="ak-list-row grid gap-3 rounded-xl border border-line p-5">
				<div>
					<h2 className="font-semibold">ngrok</h2>
					<p className="mt-1 text-sm text-muted">
						Paste your authtoken and assigned Development Domain. Arkini stores both
						locally and reuses the same public HTTPS address whenever Remote MCP starts.
					</p>
				</div>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Development domain</span>
					<input
						value={controller.ngrokDomain}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => controller.setNgrokDomain(event.currentTarget.value)}
					/>
				</label>
				<label className="grid gap-2">
					<span className="text-sm font-semibold">Authtoken</span>
					<input
						type="password"
						value={controller.authtoken}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder={
							configuredDomain === undefined
								? "Paste ngrok authtoken"
								: "Configured — paste to replace"
						}
						onChange={(event) => controller.setAuthtoken(event.currentTarget.value)}
					/>
				</label>
				<PrimaryButton
					className="justify-self-start"
					disabled={ngrokDisabled}
					onClick={controller.saveNgrok}
				>
					Save ngrok configuration
				</PrimaryButton>
				<EditorMcpStatus
					message={
						configuredDomain === undefined
							? "ngrok is not configured."
							: `Configured for ${configuredDomain}.`
					}
					tone={configuredDomain === undefined ? "muted" : "success"}
				/>
			</div>
		</div>
	);
};

export const EditorMcp = ({ section }: { readonly section: EditorMcpSectionId }) => {
	const project = useEditorProject();
	const controller = useEditorMcpController();
	const title = section === "server" ? "MCP - Server" : "MCP - Settings";
	return (
		<section
			className="h-full overflow-auto p-6"
			data-ui="EditorMcp"
		>
			<div className="mx-auto grid max-w-5xl gap-6">
				<EditorSectionNavigation
					title={<h1 className="text-xl font-semibold">{title}</h1>}
					tabs={
						<EditorSectionTabs label="MCP sections">
							{EditorMcpSections.map((candidate) => (
								<ButtonLink
									key={candidate.id}
									to="/editor/$projectId/mcp/$sectionId"
									params={{
										projectId: project.projectId,
										sectionId: candidate.id,
									}}
									activeOptions={{
										exact: true,
									}}
									activeProps={{
										className: editorSectionTabActiveClassName,
									}}
									className={editorSectionTabClassName}
								>
									{candidate.label}
								</ButtonLink>
							))}
						</EditorSectionTabs>
					}
				/>
				{controller.error === undefined ? null : (
					<EditorMcpStatus
						message={controller.error}
						tone="danger"
					/>
				)}
				{controller.overview === undefined ? (
					<EditorMcpStatus message="Loading MCP settings…" />
				) : (
					match(section)
						.with("server", () => <EditorMcpServerSettings controller={controller} />)
						.with("settings", () => <EditorMcpSettings controller={controller} />)
						.exhaustive()
				)}
			</div>
		</section>
	);
};
