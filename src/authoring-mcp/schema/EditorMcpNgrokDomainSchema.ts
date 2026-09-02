import { z } from "zod";

const HostnamePattern =
	/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const EditorMcpNgrokDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(HostnamePattern, "Enter the ngrok hostname without https:// or a path.");

export type EditorMcpNgrokDomainSchema = typeof EditorMcpNgrokDomainSchema;

export namespace EditorMcpNgrokDomainSchema {
	export type Type = z.infer<EditorMcpNgrokDomainSchema>;
}
