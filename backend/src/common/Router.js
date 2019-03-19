import _ from "lodash";
import bb from "bluebird";
import Logger from "./Logger";
import ApiError from "./ApiError";

const LOG_TAG = "Router";

/**
 * Very simple router class
 */
export default class Router {

	constructor() {
		this._routes = [];
		this._filters = [];
	}

	use(filter) {
		this._filters.push(filter);
	}

	get routes() {
		return this._routes;
	}

	get filters() {
		return this._filters;
	}

	/**
	 * Setup a route.
	 *
	 * @param {string | string[]} methods - Applicable request methods
	 * @param {string} path - Path
	 * @param {func} func - Callback function
	 * @returns Returns immediately
	 */
	on(methods, path, func) {
		/* eslint-disable lodash/prefer-lodash-method */
		const pathRegex = _.trimEnd(path, "/")
				.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")  // escape string
				.replace(/\*/g, ".*")                     // "*" matches anything
				.replace(/:\w+/g, "([^\\/\\?&#]+)");      // ":xxx" matches a path segment
		const _methods = _.isArray(methods) ? methods : [methods];
		/* eslint-enable lodash/prefer-lodash-method */

		const captureKeysRegExp = /:(\w+)/g;
		const captureKeys = [];
		let match = captureKeysRegExp.exec(path);
		while (match != null) {
			captureKeys.push(match[1]);
			match = captureKeysRegExp.exec(path);
		}

		this.routes.push({
			methods: _.map(_methods, _.toUpper),
			path: new RegExp(pathRegex + "$"),
			captureKeys,
			func
		});
	}

	invokeFilterChain(event, pathParameters, filters, routerCallbackFunc) {
		const firstFilter = _.head(filters);
		if (firstFilter) {
			const remainingChain = _.tail(filters);
			const next = (event, pathParameters) => {
				// Process remaining filter chain
				return this.invokeFilterChain(event, pathParameters, remainingChain, routerCallbackFunc);
			};

			return firstFilter(event, pathParameters, next);
		}
		else {
			// No more filters in chain
			return bb.resolve(routerCallbackFunc(event, pathParameters));
		}
	}

	/** Invoke a route with a given event by passing through filter chain */
	invokeRoute(event, pathParameters, route) {
		return this.invokeFilterChain(event, pathParameters, this.filters, route.func);
	}

	/** Finds a matching route or `undefined` if no route exists */
	_matchRoute(method, path) {
		return _.find(this.routes, route => (_.includes(route.methods, method) && route.path.test(path)));
	}

	/**
	 * Match an HTTP request event to the registered routes and executes it.
	 *
	 * @param event - Lambda proxy event object
	 * @returns Response on success or rejects with an {@link ApiError}.
	 */
	match(event) {
		if (!event) {
			return bb.reject(ApiError.NotFound());
		}

		const method = _.toUpper(event.httpMethod);
		const path = _.trimEnd(event.path, "/");
		let route = this._matchRoute(method, path);
		if (!route && method === "HEAD") {
			// Fallback implementation: Use GET instead
			route = this._matchRoute("GET", path);
		}

		if (route) {
			const match = _.slice(String(path).match(route.path), 1);
			const pathParameters = {};
			if (_.size(match) === _.size(route.captureKeys)) {
				// Create a path parameters mapping
				for (let i = 0; i < match.length; i++) {
					pathParameters[route.captureKeys[i]] = decodeURIComponent(match[i]);
				}
			}

			Logger.log(LOG_TAG, `Found a matching route for ${method} ${path}.`, { method, path, pathParameters });
			return this.invokeRoute(event, pathParameters, route);
		}
		else {
			Logger.log(LOG_TAG, `${method} ${path} did not match any known route.`, { method, path });
			return bb.reject(ApiError.NotFound());
		}
	}

	/**
	 * Look for a specific header case-insensitively
	 *
	 * @param headers - List of headers, using the header name as key
	 * @param name - Header name to look for
	 * @param defaultValue - Default value if no header is set
	 * @returns header value
	 */
	static getHeader(headers, name, defaultValue) {
		const lowerName = _.toLower(name);
		const key = _.findKey(headers, (value, key) => _.toLower(key) === lowerName);
		return _.get(headers, key, defaultValue);
	}

	/**
	 * Tests if a given origin header (`https://example.com`) matches a list of
	 * allowed domains (`[ "example.com", "mydomain.com" ]`). Any combination of
	 * subdomains such as `www.` are automatically included.
	 *
	 * @param origin - Origin string, e.g. `https://example.com`
	 * @param allowedDomains - List of allowed domains
	 * @returns `true` if origin is in the allowed domain list, `false`
	 *   otherwise.
	 */
	static isAllowedOrigin(origin, allowedDomains) {
		const allowedDomainsRegExp = _.map(allowedDomains, d => _.replace(d, ".", "\\.")).join("|");
		const regexp = new RegExp(`^(https?://)?(.*?\\.)?(${allowedDomainsRegExp})(:[0-9]+)?(/.*)?$`, "i");
		return (regexp.test(origin));
	}

	/**
	 * Builds the `X-Frame-Options` HTTP header required for a web page to
	 * be embedded in an `iframe` of another page. Defaults to `SAMEORIGIN`
	 * policy if the current origin is not in the list of allowed domains.
	 *
	 * This function uses the HTTP `Origin` and `Referrer` request headers
	 * to determine the where the `iframe` was embedded.
	 *
	 * @param event - Lambda proxy event object
	 * @param domainMapping - List of allowed origin domains that map to an `ALLOWED-FROM` url.
	 * @returns `X-Frame-Options` header value
	 *
	 * @see {@link Router#isAllowedOrigin}
	 */
	static buildXFrameOptionsHeader(event, domainMapping) {
		let allowedUrl;
		_.forEach(domainMapping, (url, domain) => {
			const origin = Router.getHeader(event.headers, "Origin");
			if (!allowedUrl && origin && Router.isAllowedOrigin(origin, [ domain ])) {
				allowedUrl = url;
			}

			const referer = Router.getHeader(event.headers, "Referer", "");
			const refererHost = referer.match(/^(https?:\/\/[^/?#]+)/i);
			if (!allowedUrl && refererHost && refererHost.length > 1 && Router.isAllowedOrigin(refererHost[1], [ domain ])) {
				allowedUrl = url;
			}
		});

		return allowedUrl ? `ALLOW-FROM ${allowedUrl}` : "SAMEORIGIN";
	}
}
