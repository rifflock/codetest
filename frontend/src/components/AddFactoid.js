import _ from "lodash";
import React, { Component } from "react";
import Modal from "react-modal";
import { Button, Form } from "react-bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';

export class AddFactoid extends Component {

	constructor(props) {
		super(props);
		this.state = {
			show: false,
		};
	}

	handleClose() {
		this.setState({
			show: false
		});
	}

	handleSubmit(evt) {
		this.props.onSubmit({
			title: this.state.title,
			body: this.state.body,
		});
		this.setState({
			show: false
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
		console.log("RENDERING ADD FACTOID");
		return (
			<div>
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
					<button variant="secondary" onClick={() => this.handleClose()}>Close</button>
					<button variant="primary" type="submit" onClick={(evt) => this.handleSubmit(evt)}>Save Changes</button>
				</footer>
			</Modal>
			</div>
		)
	}
}
