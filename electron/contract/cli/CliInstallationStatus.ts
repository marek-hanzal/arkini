export type CliInstallationStatus =
	| {
			readonly type: "installed";
			readonly commandPath: string;
	  }
	| {
			readonly type: "not-installed";
			readonly commandPath: string;
	  }
	| {
			readonly type: "repairable";
			readonly commandPath: string;
			readonly message: string;
	  }
	| {
			readonly type: "conflict";
			readonly commandPath: string;
			readonly message: string;
			readonly replaceable: boolean;
	  }
	| {
			readonly type: "unavailable";
			readonly commandPath: string;
			readonly message: string;
	  };
