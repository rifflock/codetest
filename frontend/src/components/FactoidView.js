
import _ from "lodash";
import BbPromise from "bluebird";
import React, { Component, ListItem } from "react";
import 'isomorphic-fetch';

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
		return fetch("https://api.michaelriffle.com/api/dev/factoids/viserra")
		.then(response => {
			this.props.updateItemsList(_.get(response, "items", []));
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
