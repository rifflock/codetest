import _ from "lodash";
import bb from "bluebird";
import React, { Component } from 'react';
import logo from './logo.svg';
import { ConfigConsumer } from '../components/ConfigProvider';
import './App.css';
import FactoidView from "../components/FactoidView";

class App extends Component {

	onPageLoad(factoids) {
		this.setState({
			factoids,
			lastFetch: _.now()
		});
	}

	render() {
		console.log("Rendering App");
		return (
			<div>
				<ConfigConsumer>
					{ config => (
						<div className="App">
							<header className="App-header">
								<h1 className="App-title">Welcome to {config.app.TITLE} Factoid Page</h1>
							</header>
							<p className="App-intro">
								Check out these factoids about {config.app.TITLE}
							</p>
							<div>
								<FactoidView updateItemsList={(items) => this.onPageLoad(items)} awsConfig={config.aws}/>
							</div>
						</div>
					)}
				</ConfigConsumer>
			</div>
		);
	}
}

export default App;
