#!/usr/bin/env node
import { auditGameConfig, formatGameConfigAuditWarnings } from "./auditGameConfig";
import { validateSources } from "./package";

const main = async () => {
	const packageValue = await validateSources(process.argv.slice(2));

	console.log(
		`Game config is valid: ${Object.keys(packageValue.items).length} items, ${Object.keys(packageValue.resources).length} resources.`,
	);

	const auditWarnings = auditGameConfig(packageValue);
	const warningText = formatGameConfigAuditWarnings(auditWarnings);
	if (warningText) {
		console.warn(warningText);
	}
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
