import bb from "bluebird";
import Logger from "../common/Logger";
import { FactoidApi, PeerstreetApi } from "../model-api";

const LOG_TAG = "ApiRouter";

/**
 * API Backend
 */
export class ApiRouter {

	constructor(router) {
		this._router = router;

		this.setupRoutes();
	}

	get router() {
		return this._router;
	}

	setupRoutes() {
		const router = this.router;

		router.on("OPTIONS", "*", () => bb.resolve()); // Handle CORS preflight message with an empty response

		const factoidApi = new FactoidApi();
		router.on("POST",   "/api/factoids/:topic", factoidApi.create.bind(factoidApi));
		router.on("GET",    "/api/factoids/:topic/:id", factoidApi.get.bind(factoidApi));
		router.on("PUT",    "/api/factoids/:topic/:id", factoidApi.update.bind(factoidApi));
		router.on("GET",    "/api/factoids/:topic", factoidApi.list.bind(factoidApi));
		router.on("DELETE", "/api/factoids/:topic/:id", factoidApi.delete.bind(factoidApi));

		const peerstreetApi = new PeerstreetApi();
		router.on("GET", "/api/peerstreet/:zipcode", peerstreetApi.get.bind(peerstreetApi));
	}

	/**
	 * Api Entry Point
	 *
	 * @param event - Invocation event data
	 * @returns - Resolves with HTTP response.
	 */
	routeAPIGatewayEvent(event) {
		Logger.log(LOG_TAG, "Incoming API Gateway event", { event });
		return this.router.match(event);
	}

}

export default ApiRouter;
