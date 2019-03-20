
import _ from "lodash";
import aws4 from "aws4";
import BbPromise from "bluebird";
import React, { Component } from "react";
import fetch from "isomorphic-fetch";
import { FactoidCarousel } from "./FactoidCarousel";
import { AddFactoid } from "../components/AddFactoid";
import "../client/App.css";

export default class FactoidView extends Component {

	constructor(props) {
		super();
		this.props = props;
		this.state = {
			currentIndex: 0
		};
	}

	onNavigateClick(moveRight) {
		const newIndex = moveRight ? this.state.currentIndex + 1 : this.state.currentIndex - 1;
		this.setState({
			currentIndex: newIndex % _.size(this.props.factoids),
		});
	}

	getList() {
		const path = "/api/api/factoids/viserra";
		const opts = {
			host: this.props.awsConfig.HOST,
			path,
			uri: `https://${this.props.awsConfig.HOST}${path}`,
			json: true,
			region: this.props.awsConfig.REGION,
			service: this.props.awsConfig.SERVICE,
		};

		aws4.sign(opts, {
			accessKeyId: this.props.awsConfig.KEY,
			secretAccessKey: this.props.awsConfig.SECRET,
		});
		console.log(opts);
		return fetch(opts.uri, {
			headers: opts.headers
		})
		.then(response => response.json())
		.then(data => {
			const validFacts = _.filter(_.get(data, "items", []), factoid => _.has(factoid, "title") || _.has(factoid, "body"));
			this.props.updateItemsList(validFacts);
		});
	}

	addNewFact(newFact) {
		const method = "POST";
		const path = "/api/api/factoids/viserra";
		const opts = {
			host: this.props.awsConfig.HOST,
			body: JSON.stringify(newFact),
			method,
			path,
			uri: `https://${this.props.awsConfig.HOST}${path}`,
			json: true,
			region: this.props.awsConfig.REGION,
			service: this.props.awsConfig.SERVICE,
		};

		aws4.sign(opts, {
			accessKeyId: this.props.awsConfig.KEY,
			secretAccessKey: this.props.awsConfig.SECRET,
		});
		console.log(opts);
		return fetch(opts.uri, {
			headers: opts.headers,
			method
		})
		.then(response => response.json())
		.then(data => {
			console.log(data);
			return this.getList();
		});
	}

	componentWillMount() {
		if (!_.isEmpty(this.props.items) && _.now < this.props.lastFetch + 15*60*1000) {
			return;
		}
		return this.getList();
	}

	render() {
		console.log("Rendering Factoid View");
		const validFacts = this.props.factoids;
		return (
			<div>
				<div display="block" width="100%">
				{
					_.isEmpty(validFacts) ?
					<p>
						No Factoids have been entered yet. Create one below.
					</p>
					:
					<FactoidCarousel
						index={this.state.currentIndex}
						onNavigateClick={(moveRight) => this.onNavigateClick(moveRight)}
						facts={validFacts} />
				}
				</div>
				<AddFactoid
					onSubmit={(evt) => this.addNewFact(evt)} />
			</div>
		);
	}
}
