import bb from "bluebird";
import _ from "lodash";
import ApiError from "./ApiError";

/**
 * Generic while loop for callbacks
 *
 * @param {predicateCallback} predicate - Predicate. As long as it returns true, the loop will continue.
 * @param {actionCallback} action - Function that is executed on each loop.
 * @param {Object} [value] - initial value
 * @returns {Promise}
 */
export function promiseWhile(predicate, action, value) {
	return bb.resolve(value).then(predicate).then(condition => {
		if (condition) {
			return promiseWhile(predicate, action, action());
		}
		return bb.resolve();
	});
}

/**
 * Convert an AWS response error to an ApiError.
 * @param {AWSError} awsError - AWS request error ({@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Response.html#error-property})
 * @returns {ApiError}
 */
export function AWSErrorToApiError(awsError) {
	if (!_.has(awsError.code)) {
		return ApiError.InternalServerError(awsError.message);
	}

	switch (awsError.code) {
	case "AccessDeniedException":
	case "InvalidClientTokenId":
	case "MissingAuthenticationToken":
		return ApiError.Forbidden(awsError.message);
	case "InternalFailure":
		return ApiError.InternalServerError(awsError.message);
	case "InvalidParameterCombination":
	case "InvalidParameterValue":
		return ApiError.PreconditionFailed(awsError.message);
	case "ServiceUnavailable":
		return ApiError.ServiceUnavailable(awsError.message);
	default:
		return ApiError.BadRequest(awsError.message);
	}
}

