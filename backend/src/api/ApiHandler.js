import Router from "../common/Router";
import Filters from "../common/Filters";
import { ApiRouter } from "./ApiRouter";

/**
 * API Backend
 */
export class ApiHandler {

	static get ALLOWED_HOSTS() {
		return [
			"localhost",
			"127.0.0.1",
			"michaelriffle.com",
		];
	}

	/**
	 * Dashboard Api Entry Point
	 *
	 * @param event - Invocation event data
	 * @returns - Resolves with HTTP response. Does never reject.
	 */
	static handle(event) {
		const router = new Router();
		router.use(Filters.LambdaProxyCORS(ApiHandler.ALLOWED_HOSTS));
		router.use(Filters.LambdaProxyResponder(process.env.SERVERLESS_STAGE !== "prod"));
		router.use(Filters.BodyParser());

		const apiRouter = new ApiRouter(router);
		return apiRouter.routeAPIGatewayEvent(event);
	}

}

export default ApiHandler;
