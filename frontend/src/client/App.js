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
								<img src={logo} className="App-logo" alt="logo" />
								<h1 className="App-title">Welcome to {config.app.TITLE}</h1>
							</header>
							<p className="App-intro">
								To get started, edit <code>src/App.js</code> and save to reload.
							</p>
						</div>
					)}
				</ConfigConsumer>
				<FactoidView updateItemsList={(items) => this.onPageLoad(items)}/>
			</div>
		);
	}
}

export default App;
