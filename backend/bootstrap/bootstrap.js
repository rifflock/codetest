/* eslint-disable no-console */

//------------------------------------------------------------------------------
// Framework Bootstrap File
//------------------------------------------------------------------------------
// This file needs to be included in your Lambda handler function and ensures
// that the environment is properly initialized.
//------------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import _ from "lodash";

if (process.env.IS_LOCAL || process.env.IS_OFFLINE) {
	// This allows use with `sls offline` and `sls invoke local`
	try {
		const filePath = path.resolve(process.cwd(), ".env");
		if (fs.existsSync(filePath)) {
			const doc = _.split(fs.readFileSync(filePath, "utf8"), "\n");
			_.forEach(doc, line => {
				const [ key, value ] = _.split(line, "=");
				_.set(process.env, key, value);
			});
		}
	}
	catch (err) {
		console.log(`Unable to load .env: ${err.message}`);
	}
}
