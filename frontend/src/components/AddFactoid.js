import _ from "lodash";
import aws4 from "aws4";
import React, { Component } from "react";
import Modal from "react-modal";
import { Button, Form } from "react-bootstrap";
import { ApiWrapper } from "../server/ApiWrapper";
import 'bootstrap/dist/css/bootstrap.min.css';
import "./AddFactoid.css";

export default class AddFactoid extends Component {

	constructor(props) {
		super(props);
		this.state = {
			show: false,
		};
		this.api = new ApiWrapper(this.props.awsConfig);
	}

	handleClose() {
		this.setState({
			show: false
		});
	}


	handleSubmit(evt) {
		return this.api.addFact({
			title: this.state.title,
			body: this.state.body,
		})
		.then(items => {
			this.setState({
				show: false,
				title: null,
				body: null,
			});
			return items;
		})
		.then(items => {
			this.props.updateItemsList(items);
		})
	}

	handleShow() {
		this.setState({
			show: true
		});
	}

	onChange(evt) {
		this.setState({
			[evt.target.id]: evt.target.value
		});
	}

	render() {
		return (
			<div className="add-fact-button">
			<Button type="button" active="true" variant="primary" onClick={() => this.handleShow()}>Add Fact</Button>
			<Modal isOpen={this.state.show} onHide={() => this.handleClose()}>
				<div>Add a Viserra Factoid</div>
				<Form>
					<Form.Group controlId="title">
						<Form.Label>Title</Form.Label>
						<Form.Control type="text" placeholder="Title" onChange={(evt) => this.onChange(evt)} />
						<Form.Text>Title</Form.Text>
					</Form.Group>
					<Form.Group controlId="body">
						<Form.Label>Body</Form.Label>
						<Form.Control as="textarea" rows="3" onChange={(evt) => this.onChange(evt)} />
					</Form.Group>
				</Form>
				<footer>
					<Button variant="secondary" onClick={() => this.handleClose()}>Close</Button>
					<Button variant="primary" type="submit" onClick={(evt) => this.handleSubmit(evt)}>Save Changes</Button>
				</footer>
			</Modal>
			</div>
		)
	}
}
