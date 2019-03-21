import _ from "lodash";
import bb from "bluebird";
import React, { Component } from 'react';
import logo from './logo.svg';
import { ConfigConsumer } from '../components/ConfigProvider';
import FactoidView from "../components/FactoidView";
import AddFactoid from "../components/AddFactoid";
import './App.css';

class App extends Component {

	constructor(props) {
		super(props);
		this.state = {
			factoids: []
		};
	}

	onPageLoad(factoids) {
		this.setState({
			factoids,
			lastFetch: _.now()
		});
	}

	getFacts() {
		return this.state.factoids;
	}

	render() {
		console.log("Rendering App");
		return (
			<ConfigConsumer>
				{ config => (
					<div className="App">
						<h1 className="App-title">Welcome to {config.app.TITLE} Factoid Page</h1>
						<p className="App-intro">
							Check out these factoids about {config.app.TITLE}
						</p>
						<div>
							<FactoidView
								updateItemsList={(items) => this.onPageLoad(items)}
								awsConfig={config.aws}
								getFacts={() => this.getFacts()}/>
						</div>
						<footer>
							<AddFactoid
								updateItemsList={(items) => this.onPageLoad(items)}
								awsConfig={config.aws}
								getFacts={() => this.getFacts()} />
						</footer>
					</div>
				)}
			</ConfigConsumer>
		);
	}
}

export default App;
