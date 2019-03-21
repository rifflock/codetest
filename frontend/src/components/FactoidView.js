
import _ from "lodash";
import aws4 from "aws4";
import BbPromise from "bluebird";
import React, { Component } from "react";
import { FactoidCarousel } from "./FactoidCarousel";
import { AddFactoid } from "../components/AddFactoid";
import { ApiWrapper } from "../server/ApiWrapper";
import "../client/App.css";

export default class FactoidView extends Component {

	constructor(props) {
		super();
		this.props = props;
		this.state = {
			currentIndex: 0
		};
		this.api = new ApiWrapper(this.props.awsConfig);
	}

	onNavigateClick(moveRight) {
		const newIndex = moveRight ? this.state.currentIndex + 1 : this.state.currentIndex - 1;
		const mod = newIndex % _.size(this.props.getFacts());
		const currentIndex = mod >= 0 ? mod : mod + _.size(this.props.getFacts())
		this.setState({
			currentIndex
		});
	}

	componentWillMount() {
		if (!_.isEmpty(this.props.getFacts()) && _.now < this.props.lastFetch + 15*60*1000) {
			return;
		}
		return this.api.getList()
		.then(facts => this.props.updateItemsList(facts));
	}

	render() {
		const validFacts = this.props.getFacts();
		return (
			<div className="factoid-view">
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
		);
	}
}
