import _ from "lodash";
import DataApiBase from "./DataApiBase";
import { DocClient } from "../store/DocClient";
import Logger from "../common/Logger";

const LOG_TAG = "FactoidApi";

export class FactoidApi extends DataApiBase {

	constructor() {
		super();
		this.tableName = process.env.FACTOID_TABLE;
		this.store = new DocClient();
	}

	create(event, pathParameters) {
		const { topic } = pathParameters;
		const payload = event.body;
		const item = {
			...this.store.removeEmptyValues(payload),
			topic,
			id: DocClient.generateId(),
		};
		return this.store.put({
			TableName: this.tableName,
			Item: item
		});
	}

	get(event, pathParameters) {
		const { id, topic } = pathParameters;
		Logger.log(LOG_TAG, "Getting factoid", { topic, id, tableName: this.tableName });
		return this.store.get({
			TableName: this.tableName,
			Key: { topic, id },
		});
	}

	update(event, pathParameters) {
		const payload = event.body;
		const { id, topic } = pathParameters;
		const filteredPayload = _.omit(payload, ["topic", "id"]);
		const preparedPayload = this.store.buildUpdateExpression(filteredPayload);
		return this.store.update(id, {
			...preparedPayload,
			TableName: this.tableName,
			Key: { topic, id },
		});
	}

	delete(event, pathParameters) {
		const { id, topic } = pathParameters;
		return this.store.delete({
			TableName: this.tableName,
			Key: { topic, id }
		});
	}

	list(event, pathParameters) {
		const { topic } = pathParameters;
		const cursor = _.get(event, "queryStringParameters.cursor");
		const query = this.buildQueryExpression({ topic }, null, null);
		return this.store.query(query, { cursor });
	}

}
