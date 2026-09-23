import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { Effect } from "effect";
import { z } from "zod";

import { extractSerapackFileFx } from "~/serapack-admission/fx/extractSerapackFileFx";
import type { ExtractedSerapack } from "~/serapack-admission/type/ExtractedSerapack";
import { readSerapackFileConfigFx } from "~/serapack-artifact/fx/readSerapackFileConfigFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { verifySerapackFileProvenanceFx } from "~/serapack-artifact/fx/verifySerapackFileProvenanceFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

const InstallationSchema = z
	.object({
		serakki: z.string(),
		config: GameConfigSchema,
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		projectRevision: z.number().int().nonnegative(),
		packageId: z.string().min(1),
		resources: z.array(
			z
				.object({
					uid: z.string().min(1),
					type: ResourceTypeSchema,
					path: z.string().min(1),
					size: z.number().int().nonnegative(),
				})
				.strict(),
		),
		version: z.string(),
	})
	.strict();

const readInstallationFx = Effect.fn("installSerapackFileFx.readInstallationFx")((root: string) =>
	Effect.tryPromise({
		try: async () => {
			const installation = InstallationSchema.parse(
				JSON.parse(await readFile(join(root, "installation.json"), "utf8")),
			);
			return {
				...installation,
				resources: installation.resources.map((resource) => {
					const path = resolve(root, resource.path);
					const contained = relative(root, path);
					if (
						contained === "" ||
						contained.startsWith("..") ||
						path !== resolve(root, contained)
					)
						throw new Error(
							"Installed Serapack resource escapes its installation root.",
						);
					return {
						...resource,
						path,
					};
				}),
			};
		},
		catch: (cause) => cause,
	}),
);

export namespace installSerapackFileFx {
	export interface Props {
		readonly serapackPath: string;
		readonly expectedPackageId: string;
		readonly installationsRoot: string;
	}
}

/** Reuses an exact content-hash installation or atomically publishes one streamed extraction. */
export const installSerapackFileFx = Effect.fn("installSerapackFileFx")(function* ({
	serapackPath,
	expectedPackageId,
	installationsRoot,
}: installSerapackFileFx.Props) {
	const layout = yield* readSerapackFileLayoutFx(serapackPath);
	const config = yield* readSerapackFileConfigFx(layout);
	if (config.meta.id !== expectedPackageId)
		return yield* Effect.fail(
			new Error(
				`Serapack was addressed as package ${expectedPackageId}, but its config declares ${config.meta.id}.`,
			),
		);
	const packageRoot = join(installationsRoot, encodeGameProjectFileStemFn(expectedPackageId));
	const target = join(packageRoot, layout.contentHash);
	const existing = yield* readInstallationFx(target).pipe(
		Effect.map((installation) =>
			installation.packageId === expectedPackageId &&
			installation.contentHash === layout.contentHash
				? installation
				: undefined,
		),
		Effect.catch(() => Effect.succeed(undefined)),
	);
	const provenance = yield* verifySerapackFileProvenanceFx(layout);
	if (existing !== undefined)
		return {
			...existing,
			provenance,
		} satisfies ExtractedSerapack;

	yield* Effect.tryPromise({
		try: () =>
			mkdir(packageRoot, {
				recursive: true,
			}),
		catch: (cause) => cause,
	});
	const pending = join(packageRoot, `.${layout.contentHash}.${randomUUID()}.pending`);
	return yield* Effect.gen(function* () {
		const extracted = yield* extractSerapackFileFx({
			serapackPath,
			expectedPackageId,
			outputRoot: pending,
		});
		const record = {
			serakki: extracted.serakki,
			config: extracted.config,
			contentHash: extracted.contentHash,
			projectRevision: extracted.projectRevision,
			packageId: extracted.packageId,
			resources: extracted.resources.map((resource) => ({
				uid: resource.uid,
				type: resource.type,
				path: relative(pending, resource.path),
				size: resource.size,
			})),
			version: extracted.version,
		};
		yield* Effect.tryPromise({
			try: () =>
				writeFile(join(pending, "installation.json"), JSON.stringify(record), {
					encoding: "utf8",
					flag: "wx",
				}),
			catch: (cause) => cause,
		});
		yield* Effect.tryPromise({
			try: async () => {
				try {
					await rename(pending, target);
				} catch (cause) {
					try {
						await readFile(join(target, "installation.json"));
					} catch {
						throw cause;
					}
				}
			},
			catch: (cause) => cause,
		});
		const installed = yield* readInstallationFx(target);
		return {
			...installed,
			provenance: extracted.provenance,
		} satisfies ExtractedSerapack;
	}).pipe(
		Effect.ensuring(
			Effect.tryPromise({
				try: () =>
					rm(pending, {
						force: true,
						recursive: true,
					}),
				catch: () => undefined,
			}).pipe(Effect.ignore),
		),
	);
});
