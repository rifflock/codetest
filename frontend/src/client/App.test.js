import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import config from '../server/config';
import ConfigProvider from '../components/ConfigProvider';

jest.mock('../components/ConfigProvider');

it('renders without crashing', () => {
	const div = document.createElement('div');
	ReactDOM.render(<ConfigProvider value={ config } >
		<App />
   </ConfigProvider>, div);
	ReactDOM.unmountComponentAtNode(div);
});
