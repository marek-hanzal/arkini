#!/usr/bin/env node
import {
	auditGameConfigReport,
	formatGameConfigAuditReport,
	formatGameConfigAuditWarnings,
} from "./auditGameConfig";
import { validateSources } from "./package";

type ValidateCliOptions = {
	paths: string[];
	verbose: boolean;
};

const readValidateCliOptions = (args: readonly string[]): ValidateCliOptions => {
	const paths: string[] = [];
	let verbose = false;

	for (const arg of args) {
		if (arg === "-v" || arg === "--verbose") {
			verbose = true;
			continue;
		}

		paths.push(arg);
	}

	return {
		paths,
		verbose,
	};
};

const main = async () => {
	const options = readValidateCliOptions(process.argv.slice(2));
	const packageValue = await validateSources(options.paths);
	const report = auditGameConfigReport(packageValue);

	console.log(
		`Game config is valid: ${report.summary.items} items, ${report.summary.resources} resources.`,
	);

	if (options.verbose) {
		console.log(formatGameConfigAuditReport(report));
		return;
	}

	const warningText = formatGameConfigAuditWarnings(report.warnings);
	if (warningText) {
		console.warn(warningText);
	}
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
