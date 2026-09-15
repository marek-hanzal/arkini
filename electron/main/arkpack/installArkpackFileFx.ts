import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { Effect } from "effect";
import { z } from "zod";

import { extractArkpackFileFx } from "~/arkpack-admission/fx/extractArkpackFileFx";
import type { ExtractedArkpack } from "~/arkpack-admission/type/ExtractedArkpack";
import { readArkpackFileConfigFx } from "~/arkpack-artifact/fx/readArkpackFileConfigFx";
import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";
import { verifyArkpackFileProvenanceFx } from "~/arkpack-artifact/fx/verifyArkpackFileProvenanceFx";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

const InstallationSchema = z
	.object({
		arkini: z.string(),
		config: GameConfigSchema,
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		packageId: z.string().min(1),
		resources: z.array(
			z
				.object({
					id: z.string().min(1),
					type: ResourceTypeSchema,
					path: z.string().min(1),
					size: z.number().int().nonnegative(),
				})
				.strict(),
		),
		version: z.string(),
	})
	.strict();

const readInstallationFx = Effect.fn("installArkpackFileFx.readInstallationFx")((root: string) =>
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
							"Installed Arkpack resource escapes its installation root.",
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

export namespace installArkpackFileFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly expectedPackageId: string;
		readonly installationsRoot: string;
	}
}

/** Reuses an exact content-hash installation or atomically publishes one streamed extraction. */
export const installArkpackFileFx = Effect.fn("installArkpackFileFx")(function* ({
	arkpackPath,
	expectedPackageId,
	installationsRoot,
}: installArkpackFileFx.Props) {
	const layout = yield* readArkpackFileLayoutFx(arkpackPath);
	const config = yield* readArkpackFileConfigFx(layout);
	if (config.meta.id !== expectedPackageId)
		return yield* Effect.fail(
			new Error(
				`Arkpack was addressed as package ${expectedPackageId}, but its config declares ${config.meta.id}.`,
			),
		);
	const packageRoot = join(
		installationsRoot,
		encodeGameProjectFileStemFn(expectedPackageId).replaceAll("%2E", "."),
	);
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
	const provenance = yield* verifyArkpackFileProvenanceFx(layout);
	if (existing !== undefined)
		return {
			...existing,
			provenance,
		} satisfies ExtractedArkpack;

	yield* Effect.tryPromise({
		try: () =>
			mkdir(packageRoot, {
				recursive: true,
			}),
		catch: (cause) => cause,
	});
	const pending = join(packageRoot, `.${layout.contentHash}.${randomUUID()}.pending`);
	return yield* Effect.gen(function* () {
		const extracted = yield* extractArkpackFileFx({
			arkpackPath,
			expectedPackageId,
			outputRoot: pending,
		});
		const record = {
			arkini: extracted.arkini,
			config: extracted.config,
			contentHash: extracted.contentHash,
			packageId: extracted.packageId,
			resources: extracted.resources.map((resource) => ({
				id: resource.id,
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
		} satisfies ExtractedArkpack;
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
