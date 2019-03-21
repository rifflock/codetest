import React, { Component } from "react";
import { Button } from "react-bootstrap";
import "./FactoidCarousel.css";

export class FactoidCarousel extends Component {
	render() {
		const currentFact = this.props.facts[this.props.index];
		return (
			<div className="factoid-carousel">
				<div className="inline-button">
					<Button onClick={() => this.props.onNavigateClick(false)}>
						PREV
					</Button></div>
				<div className="inline-fact">
					<p><img src={currentFact.imageUrl} className="factoid-image" /></p>
					<p><b>{ currentFact.title }</b></p>
					<p>{ currentFact.body }</p>
				</div>
				<div className="inline-button">
					<Button onClick={() => this.props.onNavigateClick(true)}>NEXT
					</Button>
				</div>
			</div>
		);
	}
}
