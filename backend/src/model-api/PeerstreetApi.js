import _ from "lodash";
import IDataApi from "./DataApiBase";
import { DocClient } from "../store/DocClient";

export class PeerstreetApi extends IDataApi {

	constructor() {
		super();
		this.tableName = process.env.FACTOID_TABLE;
		this.factoidStore = new DocClient();
	}

	create(event, pathParameters) {
		const payload = event.body;
		return this.factoidStore.put({
			TableName: this.tableName,
			Item: this.factoidStore.removeEmptyValues(payload)
		});
	}

	get(event, pathParameters) {
		const { id, topic } = pathParameters;
		return this.factoidStore.get({
			TableName: this.tableName,
			Key: { topic, id },
		});
	}

	update(event, pathParameters) {
		const payload = event.body;
		const { id, topic } = pathParameters;
		const filteredPayload = _.omit(payload, ["topic", "id"]);
		const preparedPayload = this.factoidStore.buildUpdateExpression(filteredPayload);
		return this.factoidStore.update(id, {
			...preparedPayload,
			TableName: this.tableName,
			Key: { topic, id },
		});
	}

	delete(event, pathParameters) {
		const { id, topic } = pathParameters;
		return this.factoidStore.delete({
			TableName: this.tableName,
			Key: { topic, id }
		});
	}

	list(event, pathParameters) {
		const { topic } = pathParameters;
		const cursor = _.get(event, "queryStringParameters.cursor");
		const query = this.buildQueryExpression({ topic }, null, null);
		return this.factoidStore.query(query, { cursor });
	}

}
