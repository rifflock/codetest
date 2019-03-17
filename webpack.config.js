"use strict";

const path = require("path")
	, nodeExternals = require("webpack-node-externals")
	, webpack = require("webpack")
	, slsw = require("serverless-webpack");


module.exports = {
	bail: true, // exit on any error
	context: path.resolve(__dirname),
	entry: slsw && slsw.lib ? slsw.lib.entries : [], // use Serverless' list of handlers
	output: {
		libraryTarget: "commonjs2",
		path: path.join(__dirname, ".webpack"),
		filename: "[name].js",
		sourceMapFilename: "[file].map"
	},
	target: "node",
	mode: slsw.lib.webpack.isLocal ? "development": "production",
	optimization: {
		// We no not want to minimize our code.
		minimize: false
	},
	performance: {
		// Turn off size warnings for entry points
		hints: false
	},
	resolve: {
		extensions: [ ".js", ".jsx", ".json" ]
	},
	devtool: "nosources-source-map", // we don't need source code, just the line numbers
	externals: [ nodeExternals() ],
	plugins: [
		new webpack.ProvidePlugin({
			// This allows us to use lodash in .ejs templates
			"_": "lodash",
		}),
	],
	module: {
		noParse: /jquery|lodash/,
		rules: [
			{
				// Process ES6 with Babel.
				test: /\.(js|jsx)$/,
				include: [
					path.join(__dirname, "handlers"),
					path.join(__dirname, "src"),
				],
				use: [
					{
						loader: "cache-loader",
						options: {
							cacheDirectory: path.join(__dirname, ".webpack-cache")
						}
					},
					"thread-loader",
					"babel-loader", // for options see .babelrc
				],
			}
		]
	}
};
