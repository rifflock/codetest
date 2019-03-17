import _ from "lodash";

/**
 * Simple error class to include an `errorMessage` and `errorCode` property
 * for use with Amazon API Gateway service.
 */
export default class ApiError extends Error {

	/**
	 * Create a custom error
	 * @param {string} msg - Error message
	 * @param {integer} code - Error code
	 */
	constructor(msg, code) {
		super(JSON.stringify({ errorMessage: msg, errorCode: code }));
		this.name = "ApiError";
		this.statusCode = code;
		this.statusMessage = msg;

		if (_.isFunction(Error.captureStackTrace)) {
			Error.captureStackTrace(this, this.constructor);
		}
		else {
			this.stack = (new Error(msg)).stack;
		}
	}

	/**
	 * `400 Bad Request` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static BadRequest(msg) {
		return new ApiError(msg || "Bad Request", 400);
	}

	/**
	 * `401 Unauthorized` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static Unauthorized(msg) {
		return new ApiError(msg || "Unauthorized", 401);
	}

	/**
	 * `403 Forbidden` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static Forbidden(msg) {
		return new ApiError(msg || "Forbidden", 403);
	}

	/**
	 * `404 Not Found` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static NotFound(msg) {
		return new ApiError(msg || "Not Found", 404);
	}

	/**
	 * `408 Request Timeout` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static RequestTimeout(msg) {
		return new ApiError(msg || "Request Timeout", 408);
	}

	/**
	 * `412 Precondition Failed` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static PreconditionFailed(msg) {
		return new ApiError(msg || "Precondition Failed", 412);
	}

	/**
	 * `500 Internal Server Error` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static InternalServerError(msg) {
		return new ApiError(msg || "Internal Server Error", 500);
	}

	/**
	 * `501 Not Implemented` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static NotImplemented(msg) {
		return new ApiError(msg || "Not Implemented", 501);
	}

	/**
	 * `503 Service Unavailable` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static ServiceUnavailable(msg) {
		return new ApiError(msg || "Service Unavailable", 503);
	}

	/**
	 * `504 Gateway Timeout` error
	 * @param {string} [msg] - Error message
	 * @returns {ApiError} Error instance
	 */
	static GatewayTimeout(msg) {
		return new ApiError(msg || "Gateway Timeout", 504);
	}
}
