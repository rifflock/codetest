
import _ from "lodash";
import aws4 from "aws4";
import BbPromise from "bluebird";
import React, { Component, ListItem } from "react";
import fetch from "isomorphic-fetch";

// import request from "request";

export default class FactoidView extends Component {

	constructor(props) {
		super();
		this.props = props;
	}

	componentWillMount() {
		if (!_.isEmpty(this.props.items) && _.now < this.props.lastFetch + 15*60*1000) {
			return;
		}
		const signed = aws4.sign({
			host: this.props.awsConfig.HOST,
			region: this.props.awsConfig.REGION,
			service: this.props.awsConfig.SERVICE,
			path: "/api/api/factoids/viserra",
			method: "GET",
		}, {
			accessKeyId: this.props.awsConfig.KEY,
			secretAccessKey: this.props.awsConfig.SECRET
		});
		return fetch(`${signed.host}${signed.path}`, {
			headers: signed.headers,
			method: "GET",
			crossDomain: true,
			mode: "no-cors",
			rejectUnauthorized: this.props.awsConfig.REJECT_UNAUTH,
		})
		.then(response => {
			console.log("Response", response.status, response.statusText);
			this.props.updateItemsList(_.get(response, "items", []));
		})
		.catch(error => {
			console.log(error);
		});
	}

	render() {
		console.log("Rendering Factoid View");
		if (this.props.items) {
			return (
				<div>
					{ _.map(this.props.items, (item, index) => (<ListItem key={ index } />)) }
				</div>
			);
		}
		return (
			<div>
			</div>
		);
	}
}
