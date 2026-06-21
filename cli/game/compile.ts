#!/usr/bin/env node
import { auditGameConfig, formatGameConfigAuditWarnings } from "./auditGameConfig";
import { compileDirectory } from "./package";

const main = async () => {
	const args = process.argv.slice(2);
	const inputDir = args.find((arg) => !arg.startsWith("--")) ?? "game/arkini";
	const outDirIndex = args.indexOf("--out-dir");
	const outDir = outDirIndex === -1 ? undefined : args[outDirIndex + 1];
	const result = await compileDirectory({
		inputDir,
		outDir,
	});

	console.log(`Compiled ${result.packageName}`);
	console.log(`  game: ${result.gamePath}`);
	console.log(`  assets: ${result.assetsPath}`);
	console.log(
		`  ${Object.keys(result.package.items).length} items, ${Object.keys(result.package.resources).length} resources`,
	);

	const auditWarnings = auditGameConfig(result.package);
	const warningText = formatGameConfigAuditWarnings(auditWarnings);
	if (warningText) {
		console.warn(warningText);
	}
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
