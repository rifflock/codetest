/* eslint no-console: "off", no-global-assign: "off" */
import _ from "lodash";
import chalk from "chalk";
import jsome from "jsome";

const sourceFilters = [];

// Setup log tag filters
if (process.env.LOGGER_LOG_SOURCES && _.isString(process.env.LOGGER_LOG_SOURCES)) {
	_.forEach(_.split(process.env.LOGGER_LOG_SOURCES, ","), tag => {
		const analyzedTag = /^([!])?(.*)$/.exec(_.trim(tag));
		if (analyzedTag) {
			// Allow regexes to be used as source filter patterns. This allows flexible matches.
			// Source filters prepended with "!" will be negated and regexp filter patterns must not
			// contain start/end matchers (^ and $)
			// Samples:
			// [ "myTag", "!myTag", ".*Constructor", "!.*Constructor", "myClass.*", "!myC[lL]ass.*" ]
			let sourceRegexpString = analyzedTag[2];
			if (analyzedTag[1]) {   // Negated
				sourceRegexpString = "(?!" + sourceRegexpString + ")";
			}
			sourceFilters.push(new RegExp("^" + sourceRegexpString));
		}
	});
}


/**
 * Check if a given tag is not filtered (i.e. allowed)
 * @param source - Tag to be tested
 */
function isSourceAllowed(source) {
	if (!_.isString(source) || _.isEmpty(source)) {
		return true;
	}

	return _.every(sourceFilters, filterRegexp => filterRegexp.test(source));
}

/**
 * Destroys circular references for use with JSON serialization
 *
 * @param {Object|Object[]} from - Source object or array
 * @param {Object[]} seen - Array with object already serialized. Set to `[]` (empty array) when using this function!
 * @returns {Object|Object[]} - Serialization-safe oject
 */
function destroyCircular(from, seen) {
	let to;
	if (_.isArray(from)) {
		to = [];
	}
	else {
		to = {};
	}

	seen.push(from);

	_.forEach(_.keys(from), key => {
		const value = from[key];

		if (_.isFunction(value)) {
			// No Logging of functions
			return;
		}

		if (_.isSymbol(value)) {
			to[key] = value.toString();
			return;
		}

		if (!value || !_.isObject(value)) {
			// Simple data types
			to[key] = value;
			return;
		}

		if (_.isObject(value) && _.isFunction(value)) {
			to[key] = value.toJSON();
			return;
		}

		if (_.isObject(value) && value.constructor) {
			// Superagent includes a lot of detail information in the error object.
			// For the sake of readable logs, we remove all of that garbage here.
			const className = value.constructor.name;
			if (className === "ClientRequest" || className === "IncomingMessage" ||
					className === "Buffer" || className === "TLSSocket" ||
					className === "ReadableState" || className === "WritableState") {
				to[key] = "[" + className + "]";
				return;
			}
		}

		if (!_.includes(seen, from[key])) {
			to[key] = destroyCircular(from[key], seen.slice(0));
			return;
		}

		to[key] = "[Circular]";
	});

	if (_.isString(from.name)) {
		to.name = from.name;
	}

	if (_.isString(from.message)) {
		to.message = from.message;
	}

	if (_.isString(from.stack)) {
		to.stack = from.stack;
	}

	return to;
}

/**
 * Helper function to serialize Error objects to JSON for logging
 *
 * @param {string} key - Property key
 * @param {Object} value - Property value
 * @returns {Object}
 *
 * @example
 * const myObj = { foo: "bar" };
 * const str = JSON.stringify(myObj, serializeObj, "\t");
 */
function serializeObj(key, value) {
	if (_.isObject(value) && value !== null) {
		return destroyCircular(value, []);
	}
	return value;
}


/**
 * Static class for log support
 */
export default class Logger {

	/**
	 * Allow setting a custom console object for customization or testing
	 * @param {Object} [console] - Console Object (if `null` the default console will be used)
	 */
	static set console(console) {
		Logger._console = console;
	}

	static get console() {
		return Logger._console || console;
	}

	/**
	 * Like `JSON.stringify()` but handles circular references and serializes error objects.
	 * The result of this function is always a valid JSON string. However, due to these
	 * features an object serialized into JSON is not necessarily identical to the object
	 * parsed from the serialized string.
	 *
	 * @param {Object} value - The value to convert to a JSON string.
	 * @param {string|number} space - A String or Number object that is used to insert white space
	 *        into the output JSON string for readability purposes.
	 * @returns {string} A JSON string representing the given value.
	 */
	static stringify(value, space) {
		return JSON.stringify(value, serializeObj, space);
	}

	/**
	 * Emit a log entry to the console. Optional attached data
	 * will be stringified. The output can be optimally pushed
	 * to ElasticSearch to be analyzed with Kibana.
	 * _global.suppressLog_ can be defined to supppress the
	 * log output in unit tests.
	 *
	 * @param {string} source - Originating module name
	 * @param {string} message - Message text
	 * @param {Object} [data] - Optional data attached to the log message
	 * @returns {undefined}
	 */
	static log(source, message, data) {
		if (global.suppressLog || !isSourceAllowed(source)) {
			return; // do nothing
		}

		if (chalk && chalk.enabled) {
			// Command line
			const log = chalk.magenta(`[${source}] `) + chalk.white(message);
			if (typeof data !== "undefined") {
				Logger.console.log(log + "\n" + jsome.getColoredString(destroyCircular(data, [])));
			}
			else {
				Logger.console.log(log);
			}
		}
		else {
			// Default logging, e.g. in AWS Lambda environment
			const logMessage = {
				module: source,
				message,
				data
			};
			Logger.console.log(Logger.stringify(logMessage, 2));
		}
	}

	/**
	 * Write a raw text message to the log.
	 * @param {string} message - Message to write
	 * @returns {undefined}
	 */
	static logRaw(message) {
		if (global.suppressLog === undefined || global.suppressLog === false) {
			Logger.console.log(message);
		}
	}
}
