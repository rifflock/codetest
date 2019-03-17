import _ from "lodash";
import { abstract } from "../common/Abstract";
import Logger from "../common/Logger";

export default class DataApiBase {

	@abstract
	create(event, pathParameters) {}

	@abstract
	get(event, pathParameters) {}

	@abstract
	update(event, pathParameters) {}

	@abstract
	delete(event, pathParameters) {}

	@abstract
	list(event, pathParameters) {}

	buildQueryExpression(key, filter, opts) {
		const expressionAttributeNames = {};
		const expressionAttributeValues = {};
		const scanIndexForward = !_.get(opts, "reverse", false);
		let keyConditionExpression;
		let filterExpression;
		let conditionExpression;
		if (filter && filter.filterExpression) {
			filterExpression = _.get(filter, "filterExpression");
			_.extend(expressionAttributeNames, _.get(filter, "expressionAttributeNames", {}));
			_.extend(expressionAttributeValues, _.get(filter, "expressionAttributeValues", {}));
		}

		if (key) {
			keyConditionExpression = _.join(_.keys(_.mapKeys(key, (v, k) => {
				if (_.get(v, "operator") === "begins_with") {
					return `begins_with( #__${k}__, :__${k}__ )`;
				}
				return `#__${k}__ ${_.get(v, "operator", "=")} :__${k}__`;
			})), " AND ");
			_.extend(expressionAttributeNames, _.mapKeys(_.mapValues(key, (v, k) => k), (v, k) => `#__${k}__`));
			_.extend(expressionAttributeValues, _.mapValues(_.mapKeys(key, (v, k) => `:__${k}__`), (v) => _.get(v, "value", v)));
		}
		Logger.log("DAB", "QUERY", { key, keyConditionExpression, expressionAttributeNames, expressionAttributeValues });
		return this.store.removeEmptyValues({
			TableName: this.tableName,
			ScanIndexForward: scanIndexForward,
			KeyConditionExpression: keyConditionExpression,
			FilterExpression: filterExpression,
			ConditionExpression: conditionExpression,
			ExpressionAttributeNames: expressionAttributeNames,
			ExpressionAttributeValues: expressionAttributeValues
		});
	}
}
