import _ from "lodash";
import bb from "bluebird";
import ApiError from "./ApiError";
import Logger from "./Logger";
import Router from "./Router";

const LOG_TAG = "Filters";

export default class Filters {

	static BodyParser() {
		return function(event, pathParameters, nextPromise) {
			return bb.try(() => {
				const contentType = Router.getHeader(event.headers, "Content-Type", "application/json");
				if (event.body && _.isString(event.body) && /^application\/json(\s*;.*)?$/i.test(contentType)) {
					event = _.clone(event);
					event.body = JSON.parse(event.body);
				}
			})
			.catch(_.noop) // ignore JSON parse errors
			.then(() => nextPromise(event, pathParameters));
		};
	}

	/**
	 * Adds CORS headers or blocks the request if origin is not allowed
	 * @param allowedHosts - List of allowed host names; allows requests if empty
	 */
	static LambdaProxyCORS(allowedHosts = []) {
		return function(event, pathParameters, nextPromise) {
			const origin = Router.getHeader(event.headers, "Origin");
			if (_.isEmpty(origin) || _.isEmpty(allowedHosts) || Router.isAllowedOrigin(origin, allowedHosts)) {

				return bb.resolve(nextPromise(event, pathParameters))
				.then((response) => {
					response.headers = _.extend({
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": _.join(
							[ "GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS" ], ", "),
						"Access-Control-Allow-Headers": _.join(
							[ "Content-Type", "Authorization", "X-Amz-Date",
								"X-Amz-Security-Token", "X-Amz-User-Agent", "X-Api-Key" ], ", "),
					}, response.headers);
					return bb.resolve(response);
				});
			}
			else {
				// Don't allow cross origin requests from a web site we don't own or control
				return bb.reject(ApiError.Forbidden(`${origin} is not allowed`));
			}
		};
	}

	/**
	 * Generic error handler for Lambda proxy requests. Any exception thrown in
	 * a subsequent filter or the router callback will be wrapped into a graceful
	 * response message.
	 *
	 * @param prettyPrint - Format JSON
	 */
	static LambdaProxyErrorResponder(prettyPrint) {
		return function(event, pathParameters, nextPromise) {
			return bb.resolve(nextPromise(event, pathParameters))
			.catch(err => {
				Logger.log(LOG_TAG, "Replying with error", { error: err.toString(), stack: _.split(err.stack, "\n") });

				const headers = {};
				let statusCode = 500;
				let message = err.message || err.toString();
				let body;
				if (err instanceof ApiError) {
					// Forward API errors
					statusCode = err.statusCode;
					message = err.statusMessage;
				}
				else if (err.statusCode && err.message) {
					// Forward AWS errors
					statusCode = _.toInteger(err.statusCode);
					message = err.message;
				}

				const accept = Router.getHeader(event.headers, "Accept");
				if (!accept || /application\/json/i.test(accept) || /\*\/\*/.test(accept)) {
					// Respond with a JSON error
					const data = { status: statusCode, message };
					headers["Content-Type"] = "application/json;charset=utf-8";
					body = prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
				}
				else if (/text\/html/i.test(accept)) {
					// Respond with an HTML page
					headers["Content-Type"] = "text/html;charset=utf-8";
					body = _.replace(
						`<html>
							<head>
								<title>${_.escape(message)}</title>
							</head>
							<body>
								<h1>${_.escape(message)}</h1>
							</body>
						</hmtl>`
						, /^\t+/m, "");
				}
				else {
					// ApiError bodies are the plain status message - we have to set the
					// correct Content_type "text/plain" to let the client know
					headers["Content-Type"] = "text/plain";
					body = message;
				}

				return bb.resolve({ headers, statusCode, body });
			});
		};
	}

	/**
	 * Similar to {@link Filters#LambdaProxyErrorResponder} this filter ensures that
	 * that the response is a valid Lambda proxy response.
	 *
	 * @param prettyPrint - Format JSON
	 */
	static LambdaProxyResponder(prettyPrint) {
		const errorResponderFilter = Filters.LambdaProxyErrorResponder(prettyPrint);
		return function(event, pathParameters, nextPromise) {
			// We cascade the error responder so all exceptions will be handled with
			// a graceful HTML/JSON response as well.
			return errorResponderFilter(event, pathParameters, (event, pathParameters) => {
				return bb.try(() => {
					// Some clients might invoke this Lambda directly without setting all
					// properties. Let's handle this here with some reasonable defaults.
					event.pathParameters = event.pathParameters || {};
					event.queryStringParameters = event.queryStringParameters || {};
					event.headers = event.headers || {};

					return bb.resolve(nextPromise(event, pathParameters))
					.then(data => {
						// We enforce a JSON response here
						const statusCode = 200;
						const headers = { "Content-Type": "application/json;charset=utf-8" };
						const body = prettyPrint ? JSON.stringify(data, null, 2) : JSON.stringify(data);
						Logger.log(LOG_TAG, `Responding with HTTP Status ${statusCode}.`);

						return bb.resolve({ headers, statusCode, body });
					});
				});
			});
		};
	}
}
