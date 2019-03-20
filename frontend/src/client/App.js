import _ from "lodash";
import bb from "bluebird";
import React, { Component } from 'react';
import logo from './logo.svg';
import { ConfigConsumer } from '../components/ConfigProvider';
import FactoidView from "../components/FactoidView";
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
							<FactoidView
								updateItemsList={(items) => this.onPageLoad(items)}
								awsConfig={config.aws}
								factoids={this.state.factoids}/>
						</div>
					)}
				</ConfigConsumer>
			</div>
		);
	}
}

export default App;
