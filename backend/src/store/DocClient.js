import _ from "lodash";
import DynamoDb from "aws-sdk/clients/dynamodb";
import DocumentClient from "aws-sdk/lib/dynamodb/document_client";
import bb from "bluebird";
import { ulid } from "ulid";
import https from "https";
import crypto from "crypto";
import base62 from "base-x";
import ApiError from "../common/ApiError";
import { promiseWhile } from "../common/Utils";
import Logger from "../common/Logger";

const dynamoDB = new DynamoDb({
	apiVersion: "2012-08-10",
	httpOptions: {
		agent: new https.Agent({
			secureProtocol: "TLSv1_method",
			ciphers: "ALL"
		})
	},
	region: process.env.SERVERLESS_REGION
});

/**
 * Default cypher password used if the client does not provide one.
 * For security reasons every client should set its own via the options
 * object in the various calls.
 */
const DYNAMO_DEFAULT_CYPHER_PASSWORD = "wZ5K8Wk5";

/**
 * Maximum number of retries when executing batchWrite operations.
 */
const MAX_DYNAMO_BATCH_RETRIES = 2;

/**
 * @typedef {Map} Options
 * @property {Object} cursor - Cursor to use for scan and query operations
 * @property {string} cryptoKey - Custom key to use for cursor en-/decryption
 * @property {boolean} ensureItems - Ensure that at least one item is returned
 * @property {Object} segment - Explicit XRay parent to use for tracing the calls
 * @property {boolean} count - If true, return item count without data
 */

/**
 * @typedef {Object} DocClientResult
 * @property {Object[]} items - List of items found
 * @property {number} count - Number of items found
 * @property {string|undefined} cursor - Optional cursor for pagination
 */

// Static singleton instance of AWS DynamoDB DocumentClient
let _docClient;

/**
 * Encrypt a string as base62
 *
 * @param {string} data - An unencrypted string
 * @param {string} key - Key used for encryption
 * @returns {string} - Encrypted string as base62
 * @throws crypto package can throw synchronous exceptions
 */
function encryptStringAsBase62(data, key) {
	const cipher = crypto.createCipher("aes-256-cbc", key);

	// Note the use of short parameter names to ensure short URLs
	return base62.encode(Buffer.concat([ cipher.update(data, "utf8"), cipher.final() ]));
}

/**
 * Decrypt a string from a base62 encoded encrypted string
 *
 * @param {string} encData - An unencrypted string
 * @param {string} key - Key used for decryption
 * @returns {string} - Decrypted string
 * @throws crypto package can throw synchronous exceptions
 */
function decryptStringFromBase62(encData, key) {
	const rawEncData = new Buffer(base62.decode(encData));

	const decipher = crypto.createDecipher("aes-256-cbc", key);
	const userData =  Buffer.concat([ decipher.update(rawEncData), decipher.final() ]);
	return userData.toString("utf8");
}

const LOG_TAG = "DocClient";

/**
 * Simple helper for AWS DynamoDB DocumentClient using Promises.
 * We are going to wrap all list responses with a standardized retrun.
 * All retrun values will contain either two or three elements.
 * * items - The items found during the query/scan
 * * count - The number of items in the items array
 * * cursor [optional] - Our solution to the pagination issue.
 * If there are additional items to find we will get a LastEvaluatedKey, which encrypt into a cursor.
 * All input parameters are the DynamoDB query object and an optional options
 * map that can contain supported processing options.
 * Currently the allowed options are:
 * * cursor
 * * cryptoKey
 * * ensureItems
 */
export class DocClient {
	/**
	 * Instantiate the helper. This will automatically choose the current
	 * AWS region based on `processenv.SERVERLESS_REGION`.
	 */
	constructor() {
		if (!_docClient) {
			_docClient = new DocumentClient({ service: dynamoDB });
		}

		this._docClient = _docClient;
	}

	/**
	 * Get a single item by primary key
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<Object>}
	 */
	get(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			query = this._applySelectorOptions(query, options);
			Logger.log(LOG_TAG, "Calling get with query", { query, region: process.env.SERVERLESS_REGION });
			return bb.fromCallback(cb => this._docClient.get(query, cb));
		})
		.then(result => {
			if (!result || _.isEmpty(result.Item)) {
				return bb.reject(ApiError.NotFound());
			}
			return bb.resolve(result.Item);
		});
	}

	/**
	 * Store a single item
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<undefined>}
	 */
	put(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			return bb.fromCallback(cb => this._docClient.put(query, cb));
		})
		.return();
	}

	/**
	 * Store a batch of items
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<Object>}
	 * The result contains an unprocessedItems map that contains all items that
	 * were not successfully written even after some retries.
	 */
	batchWrite(query, options) {
		const doBatchWrite = (query, tries) => {
			return bb.fromCallback(cb => this._docClient.batchWrite(query, cb))
			.then(result => {
				if (!_.isEmpty(result.UnprocessedItems) && tries < MAX_DYNAMO_BATCH_RETRIES) {
					return bb.delay(100 * Math.pow(2, tries)).then(() => doBatchWrite({ RequestItems: result.UnprocessedItems }, tries + 1));
				}

				return { unprocessedItems: result.UnprocessedItems };
			});
		};

		return bb.try(() => {
			query = this._extendQuery(query, options);
			return doBatchWrite(query, 0);
		});
	}

	/**
	 * Update an item
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<Object>}
	 */
	update(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			return bb.fromCallback(cb => this._docClient.update(query, cb));
		})
		.then(result => bb.resolve(result.Attributes));
	}

	/**
	 * High-level helper function to update just the given properties
	 * of a document.
	 *
	 * @param {Object} properties - Properties to set
	 * @returns {Object} Update expression
	 * @public
	 */
	buildUpdateExpression(properties) {
		// First of all we traverse all properties and remove empty values from
		// objects and arrays. The properties themselves remain unchanged though,
		// as we still need to check which ones to set and which ones to remove.
		if (properties && _.isFunction(properties.toJSON)) {
			// We always want store the JSON representation, not the raw object
			properties = properties.toJSON();
		}
		_.each(properties, (value, key) => {
			properties[key] = this.removeEmptyValues(value);
		});

		// We check properties for any null values. These will have
		// to be handled differently to remove them from the DynamoDB
		const propsToRemove = _.pickBy(properties, v => _.isNil(v) || v === "");
		const propsToSet = _.omitBy(properties, v => _.isNil(v) || v === "");

		const removeExp = _.map(propsToRemove, (v, k) => `#${k}`);
		const setExp = _.map(propsToSet, (v, k) => `#${k} = :${k}`);
		const attNames = _.mapKeys(_.mapValues(properties, (v, k) => k), k => `#${k}`);
		const attValues = _.mapKeys(propsToSet, (v, k) => `:${k}`);

		const exp = {
			UpdateExpression: _.join(_.compact([
				_.isEmpty(setExp)    ? null : "SET " + _.join(setExp, ", "),
				_.isEmpty(removeExp) ? null : "REMOVE " + _.join(removeExp, ", ")
			]), " "),
			ExpressionAttributeNames: attNames,
			ExpressionAttributeValues: _.isEmpty(attValues) ? undefined : attValues
		};
		return exp;
	}

	/**
	 * AWS DocumentClient does not support setting nil or empty string values.
	 * This function operates in-place, changing the original object being passed in!
	 *
	 * @param {Object} obj - Object to update
	 * @returns {Object} the same object passed in
	 * @public
	 */
	removeEmptyValues(obj) {
		if (obj && _.isFunction(obj.toJSON)) {
			// We always want store the JSON representation, not the raw object
			obj = obj.toJSON();
		}
		if (_.isPlainObject(obj)) {
			// dive deeper in
			_.each(obj, (value, key) => {
				obj[key] = value = this.removeEmptyValues(value);
				if (value === "" || _.isNil(value)) {
					// delete elements that are nil or empty strings
					delete obj[key];
				}
			});
		}
		if (_.isArray(obj)) {
			// dive deeper in
			for (let i = obj.length-1; i >= 0 ; i--) {
				const value = obj[i] = this.removeEmptyValues(obj[i]);
				if (value === "" || _.isNil(value)) {
					// delete elements that are nil or empty strings
					obj.splice(i, 1);
				}
			}
		}
		return obj;
	}

	/**
	 * Delete an item
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<undefined>}
	 */
	delete(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			return bb.fromCallback(cb => this._docClient.delete(query, cb));
		})
		.return();
	}

	/**
	 * Scan for items matching the given criteria
	 *
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<Object>} Raw DynamoDB response
	 */
	scan(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			query = this._applySelectorOptions(query, options);
			if (_.get(options, "count", false)) {
				query.Select = "COUNT";
			}
			if (_.get(options, "ensureItems")) {
				return this._ensureItems(this.scan.bind(this), query, options);
			}
			return bb.fromCallback(cb => this._docClient.scan(query, cb))
			.then(result => DocClient._simplifyResult(result, _.get(options, "cryptoKey")));
		});
	}

	/**
	 * Query for items matching the given criteria
	 *
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {Promise<Object>} Returns a simplified version of the DynamoDb response
	 */
	query(query, options) {
		return bb.try(() => {
			query = this._extendQuery(query, options);
			query = this._applySelectorOptions(query, options);
			if (_.get(options, "count", false)) {
				query.Select = "COUNT";
			}
			if (_.get(options, "ensureItems")) {
				return this._ensureItems(this.query.bind(this), query, options);
			}
			return bb.fromCallback(cb => this._docClient.query(query, cb))
			.then(result => DocClient._simplifyResult(result, _.get(options, "cryptoKey")));
		});
	}

	/**
	 * Count records for given filter/attributes using @see DocClient~scan()
	 * Scan operations are expensive and slow. Alternatively you should
	 * check if you can make use of @see DocClient~queryCount() which is
	 * faster and does not drain provisioning unnecessarily.
	 * @param {string} tableName - Table
	 * @param {string} [filterExp] - DynamoDB FilterExpression
	 * @param {Object} [attrNames] - DynamoDB AttributeNames
	 * @param {Object} [attrValues] - DynamoDB AttributeValues
	 * @returns {Promise<integer>} - Record count
	 */
	scanCount(tableName, filterExp, attrNames, attrValues) {
		let cursor;
		let done = false;
		let count = 0;

		// Check parameters
		if (!tableName || !_.isString(tableName) || _.isEmpty(tableName)) {
			return bb.reject(new Error("Invalid arguments"));
		}

		return promiseWhile(() => !done, () => {
			return this.scan({
				TableName: tableName,
				FilterExpression: filterExp || undefined,
				ExpressionAttributeNames: attrNames || undefined,
				ExpressionAttributeValues: attrValues || undefined,
				Select: "COUNT"
			}, { cursor })
			.then(result => {
				count += result.count;
				cursor = result.cursor;
				done = _.isNil(cursor);
				return bb.resolve();
			});
		})
		.then(() => count);
	}

	/**
	 * Count records for given filter/attributes using @see DocClient~query()
	 * @param {string} tableName - Table
	 * @param {string} keyConditionExp - DynamoDB KeyConditionExpression
	 * @param {Object} [filterExp] - DynamoDB filter expression
	 * @param {Object} [attrNames] - DynamoDB AttributeNames
	 * @param {Object} [attrValues] - DynamoDB AttributeValues
	 * @param {string} [indexName=PRIMARY] - Index
	 * @returns {Promise<integer>} - Record count
	 */
	queryCount(tableName, keyConditionExp, filterExp, attrNames, attrValues, indexName) {
		let cursor;
		let done = false;
		let count = 0;

		// Check parameters
		if (!tableName || !_.isString(tableName) || _.isEmpty(tableName)) {
			return bb.reject(new Error("Invalid arguments"));
		}

		return promiseWhile(() => !done, () => {
			return this.query({
				TableName: tableName,
				IndexName: indexName || undefined,
				KeyConditionExpression: keyConditionExp || undefined,
				FilterExpression: filterExp || undefined,
				ExpressionAttributeNames: attrNames || undefined,
				ExpressionAttributeValues: attrValues || undefined,
				Select: "COUNT"
			}, { cursor })
			.then(result => {
				count += result.count;
				cursor = result.cursor;
				done = _.isNil(cursor);
				return bb.resolve();
			});
		})
		.then(() => count);
	}

	/**
	 * The populate results function will iterate over successive calls to the
	 * same endpoint and not resolve until it has retrieved AT LEAST one item
	 * to return OR has reached the end of pages of items.
	 *
	 * @param {Function} docClientFunc - One of the DocClient class functions that takes options and returns results
	 * @param {Object} query - DynamoDB Query
	 * @param {Options} [options] - Processing options (@see Options)
	 * @returns {DocClientResult} - Returns the result of the first iteration with items (or the last iteration)
	 * @private
	 */
	_ensureItems(docClientFunc, query, options) {
		let finalResult = {
			items: [],
			count: 0
		};
		let done = false;
		let cursor;
		// Prevent change of given options - while can take longer!
		const _options = _.cloneDeep(options);
		_options.ensureItems = false;
		return promiseWhile(() => !done, () => {
			if (cursor) {
				_options.cursor = cursor;
				cursor = null;
			}
			return docClientFunc(query, _options)
			.then(result => {
				finalResult = result;
				cursor = result.cursor;
				done = (!_.isEmpty(result.items) || !result.cursor);
				return;
			});
		})
		.then(() => finalResult);
	}

	/**
	 * Extend the AWS query with the given options
	 *
	 * @param {Object} query - The current AWS query
	 * @param {Object} options - The options we will use to amend the query
	 * @property {string} options.segment - The segment to use in the new query
	 * @property {string} options.cursor - The cursor used for pagination in the Dynamo query
	 * @returns {Object} - The modified query (or original if no new data added)
	 */
	_extendQuery(query, options) {
		const newQuery = _.cloneDeep(query);
		options = options || {};

		if (options.cursor) {
			newQuery.ExclusiveStartKey = DocClient._decryptCursor(options.cursor, options.cryptoKey);
		}
		return newQuery;
	}

	/**
	 * Apply the ProjectionExpression if includeFields option is passed
	 * Apply the Limit if limit option is passed
	 *
	 * @param {Object} query - The AWS DocClient query to amend
	 * @param {Object} options - The options passed to extend the query
	 * @property {Array<string>} options.includeFields - An array of Dynamo table field names
	 * @property {number} options.limit - Maximum number of items to return
	 * @returns {Object}
	 */
	_applySelectorOptions(query, options) {
		if (!_.has(options, "includeFields") && !_.has(options, "limit")) {
			return query;
		}

		const newQuery = _.cloneDeep(query);

		// Only set ProjectionExpression if we have values, otherwise we use the default
		const includeFields = _.get(options, "includeFields");
		if (_.isArray(includeFields) && !_.isEmpty(includeFields)) {
			const includeFieldNames = _.map(includeFields, v => `#${v}`);
			newQuery.ExpressionAttributeNames = _.extend(_.get(query, "ExpressionAttributeNames", {}), _.mapKeys(includeFields, v => `#${v}`));
			newQuery.ProjectionExpression = _.join(includeFieldNames, ", ");
		}

		if (_.has(options, "limit") && _.isNumber(options.limit)) {
			newQuery.Limit = options.limit;
		}

		return newQuery;
	}

	/**
	 * Creates a random ID string for use with DynamoDB
	 */
	static generateId() {
		return ulid();
	}

	/**
	 * Simplify a DynamoDB response for a list of items.
	 *
	 * @param {Object} result - The result of a query or scan action
	 * @param {string} [cryptoKey] - Key used for decryption
	 * @returns {Object} - consistent return object containing items {Object[]}, count {Number}, cursor {string}.
	 */
	static _simplifyResult(result, cryptoKey) {
		const count = _.has(result, "Count") ? result.Count : _.get(result, "Items.length", 0);
		return {
			items: _.get(result, "Items", []),
			count,
			cursor: DocClient._encryptCursor(_.get(result, "LastEvaluatedKey"), cryptoKey)
		};
	}

	/**
	 * Encrypts an ExclusiveStartKey or LastEvaluatedKey object into a cursor
	 *
	 * @param {Object} dynamoKey - The DynamoDb ExclusiveStartKey or LastEvaluatedKey to encrypt
	 * @param {string} [encKey=DYNAMO_DEFAULT_CYPHER_PASSWORD] - Encryption key. Should be set explicitly to ensure better security.
	 * @returns {string|undefined} - An encrypted cursor string
	 * @private
	 */
	static _encryptCursor(dynamoKey, encKey) {
		if (!dynamoKey) {
			return;
		}
		return encryptStringAsBase62(JSON.stringify(dynamoKey), encKey || DYNAMO_DEFAULT_CYPHER_PASSWORD);
	}

	/**
	 * Convert a cursor into an ExclusiveStartKey object
	 *
	 * @param {string} cursor - An encrypted cursor
	 * @param {string} [decKey=DYNAMO_DEFAULT_CYPHER_PASSWORD] - Decryption key. Should be set explicitly to ensure better security.
	 * @returns {Object} - Parses decrypted cursor into a key
	 * @throws {Error} - If cursor does not decrypt to a string representation of an object
	 * @private
	 */
	static _decryptCursor(cursor, decKey) {
		let key;
		try {
			// Should be parseable
			const decryptedString = decryptStringFromBase62(cursor, decKey || DYNAMO_DEFAULT_CYPHER_PASSWORD);
			key = JSON.parse(decryptedString);
		}
		catch (err) {
			throw new Error("Invalid cursor");
		}
		return key;
	}

}
