/**
 * @flow
 * Abstract decorator that will throw if a function is not overwritten.
 * This works with static and instance member functions.
 */

import _ from "lodash";

export function abstract(target, propertyKey, descriptor) {

	// For this is only supported for methods, not properties or classes
	if (_.isNil(propertyKey)) {    // class decorated
		throw new SyntaxError(`Cannot decorate class ${target.name} with @abstract`);
	}

	if (_.isNil(descriptor)) {     // property decorated
		throw new SyntaxError(`Cannot decorate ${propertyKey} with @abstract`);
	}

	const baseClassName = target.name || target.constructor.name || "unknown";
	const abstractErrorFunction = function() {
		throw new TypeError(`Class method ${baseClassName}.${propertyKey} is abstract and must be overwritten.`);
	};

	if (_.has(descriptor, "get") || _.has(descriptor, "set")) {
		// getter/setter property
		if (descriptor.get) {
			descriptor.get = abstractErrorFunction;
		}
		if (descriptor.set) {
			descriptor.set = abstractErrorFunction;
		}
	}
	else if (_.has(descriptor, "value")) {
		// Method
		descriptor.value = abstractErrorFunction;
	}
	else {
		throw new SyntaxError(`Invalid abstract decoration ${baseClassName}.${propertyKey}`);
	}
}
