import _ from "lodash";
import aws4 from "aws4";
import fetch from "isomorphic-fetch";

export class ApiWrapper {

	constructor(config) {
		this.config = config
	}

	getList() {
		const method = "GET";
		const path = "/api/api/factoids/viserra";
		const opts = {
			host: this.config.HOST,
			path,
			method,
			uri: `https://${this.config.HOST}${path}`,
			json: true,
			region: this.config.REGION,
			service: this.config.SERVICE,
		};

		aws4.sign(opts, {
			accessKeyId: this.config.KEY,
			secretAccessKey: this.config.SECRET,
		});
		return fetch(opts.uri, {
			headers: opts.headers,
			method,
			mode: "cors"
		})
		.then(response => response.json())
		.then(data => {
			const validFacts = _.filter(_.get(data, "items", []), factoid => _.has(factoid, "title") || _.has(factoid, "body"));
			return validFacts;
		});
	}

	addFact(newFact) {
		const method = "POST";
		const path = "/api/api/factoids/viserra";
		const opts = {
			host: this.config.HOST,
			body: JSON.stringify(newFact),
			method,
			path,
			uri: `https://${this.config.HOST}${path}`,
			json: true,
			headers: {
				"Content-Type": "application/json",
			},
			region: this.config.REGION,
			service: this.config.SERVICE,
		};

		aws4.sign(opts, {
			accessKeyId: this.config.KEY,
			secretAccessKey: this.config.SECRET,
		});
		return fetch(opts.uri, opts)
		.then(data => this.getList());
	}
}
