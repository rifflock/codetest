import { ApiHandler } from "../../src/api/ApiHandler";
import "../../bootstrap/bootstrap";
module.exports.handler = async (event) => {
	return await ApiHandler.handle(event);
};
