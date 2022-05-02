import {InsightDatasetKind, InsightError} from "../IInsightFacade";
import {
	ApplyOperation,
	Comparison,
	ComplexQuery,
	default as util,
	Direction,
	Field,
	Logic,
	SingleApply,
	SingleQuery
} from "./PerformQueryUtil";
import FieldParser from "./Field Parsers/FieldParser";
import FieldParserFactory from "./Field Parsers/FieldParserFactory";

// Contains all methods for parsing the various parts of a query.
// An instance of this is specific to a given dataset and query.
export default class QueryParser {
	private readonly targetDatasetID: string;
	private readonly query: any;
	private readonly fieldParser: FieldParser;

	constructor(targetDatasetID: string, datasetKind: InsightDatasetKind, query: any) {
		this.targetDatasetID = targetDatasetID;
		this.fieldParser = FieldParserFactory.newParser(targetDatasetID, datasetKind);
		this.query = query;
	}

	// Parses the 'OPTIONS' and returns the columns and order
	// Note that columns and keys should have datasetID still attached to them
	public parseOptions(): { columns: string[], direction: Direction, keys: string[] } {
		const columns: string[] = this.parseColumns(this.query.OPTIONS.COLUMNS);
		const parsedOrder: any = this.parseOrder(this.query.OPTIONS.ORDER);
		const direction: Direction = parsedOrder.direction;
		const keys: string[] = parsedOrder.keys;
		return { columns: columns, direction: direction, keys: keys};
	}

	// Parses the 'WHERE' and returns a parsed query (SingleQuery | ComplexQuery)
	public parseWhere(): SingleQuery | ComplexQuery {
		return this.parseWhereObject(this.query.WHERE, false);
	}

	// Parses the 'TRANSFORMATIONS' object and returns the parsed GROUP and APPLY objects
	// Can assume that if there is a transformations, contains GROUP and APPLY keys
	public parseTransformations(): { group: Field[], applyKeys: SingleApply[] } {
		const group: Field[] = this.parseGroup();
		const applyKeys: SingleApply[] = this.parseApply();
		return {group: group, applyKeys: applyKeys};
	}

	// parses a 'Comparison' from a given 'WHERE' object. Throws error if no valid key (or too many keys)
	private parseWhereKey(whereObject: any): Comparison | Logic {
		// check that there is only one comparison field in WHERE
		if (Object.keys(whereObject).length !== 1) {
			throw new InsightError(
				"Expected 1 key in WITH, " + Object.keys(whereObject).length + " keys were provided"
			);
		}

		// checking that there is valid comparison field provided
		const whereKey: string = Object.keys(whereObject)[0];
		let ret: Comparison | Logic | undefined;
		if (util.isComparison(whereKey)) {
			ret = util.getComparison(whereKey);
		} else if (util.isLogic(whereKey)) {
			ret = util.getLogic(whereKey);
		} else {
			ret = undefined;
		}

		if (ret) {
			return ret;
		} else {
			throw new InsightError(`Invalid comparison key '${Object.keys(whereObject)[0]}' provided in WHERE.`);
		}
	}

	// Given a "WHERE" object (or equivalent) (eg. anything that contains logic/comparison as a key)
	// parses and returns a "SingleQuery" or "ComplexQuery" (or throws error when necessary).
	// "Negation" parameter is true if this query should be negated ("NOT"-ed)
	private parseWhereObject(whereObject: any, negation: boolean): SingleQuery | ComplexQuery {
		// Is the first key in the where Object (also ensures there is only one key in object).
		const objectKey: Comparison | Logic = this.parseWhereKey(whereObject);
		if (util.isComparison(objectKey)) {
			// Case where key is a comparison key (eg. GT, EQ, LT), create a SingleQuery
			const fieldValuePair = this.parseComparisonObject(Object.values(whereObject)[0]);
			const field: Field = fieldValuePair["field"];
			const value: any = fieldValuePair["value"];
			const ret: SingleQuery = {kind: "SingleQuery", field: field, value: value, comparison: objectKey,
				negation: negation};
			return ret;
		} else if (util.isLogic(objectKey)) {
			// Case where key is a logic key (eg. AND, OR, NOT), create a ComplexQuery
			if (util.getLogic(objectKey) === Logic.NOT) {
				// "NOT" case
				return this.parseWhereObject(Object.values(whereObject)[0], !negation);
			} else {
				// "AND" or "OR" case
				const complexQueries: ComplexQuery[] = [];
				const singleQueries: SingleQuery[] = [];
				const logic: Logic = util.getLogic(objectKey) as Logic;
				const arrayObjects: any[] = Object.values(whereObject)[0] as any[];
				// Making sure a valid array was given
				if (!(arrayObjects.length > 0)) {
					throw new InsightError(`Expected a non-empty array in '${objectKey}'
					but got ${arrayObjects}.`);
				}
				// Parsing all elements in array
				arrayObjects.forEach((element) => {
					const parsedQuery: SingleQuery | ComplexQuery = this.parseWhereObject(element, false);
					if (parsedQuery.kind === "SingleQuery") {
						singleQueries.push(parsedQuery);
					} else if (parsedQuery.kind === "ComplexQuery") {
						complexQueries.push(parsedQuery);
					}
				});

				// Returning
				const ret: ComplexQuery = {kind: "ComplexQuery", complexQueries: complexQueries,
					singleQueries: singleQueries, logic: logic, negation: negation,};
				return ret;
			}
		} else {
			throw new InsightError(`Invalid key '${objectKey}' provided.`);
		}
	}

	// parses Field and Value from a given comparison object. Throws error if no valid Field, or invalid ID
	// THIS ALSO INITIALIZES DATASET ID
	private parseComparisonObject(comparisonObject: any): { field: Field; value: any; } {
		// check that there is one key in this comparison
		if (Object.keys(comparisonObject).length !== 1) {
			throw new InsightError(
				"Expected 1 key in comparison, " + Object.keys(comparisonObject).length + " keys were provided"
			);
		}

		// parsing 'Field' from the key
		const field: Field = this.fieldParser.parseIdAndField(Object.keys(comparisonObject)[0]).field;

		// parsing 'value' from the object
		let value: any = Object.values(comparisonObject)[0];

		// Checking typeof(value) matches expected type for field
		if (!this.fieldParser.checkFieldValuePair(field, value)) {
			throw new InsightError(`Invalid value '${value}' provided for field '${field}'.`);
		}

		// returning
		return {
			field: field,
			value: value,
		};
	}

	// parses an 'COLUMNS' object, and returns an array of included columns
	private parseColumns(columnsObject: any[]): string[] {
		// check that 'columnsObject' is a non-empty array
		if (!(columnsObject.length > 0)) {
			throw new InsightError("'COLUMNS' can not be an empty array.");
		}

		// Parsing all Fields from columnsObject and pushing it onto ret
		const ret: string[] = [];
		columnsObject.forEach((element) => {
			// Checking element is of correct type
			if (!(typeof element === "string")) {
				throw new InsightError(`Improper element '${element}' provided in COLUMNS.`);
			}

			this.fieldParser.validateField(element);
			ret.push(element);
		});

		return ret;
	}

	// Parses the given 'orderObject' into an array of fields
	private parseOrder(orderObject: any): { direction: Direction, keys: string[] } {
		// UP is default sorting direction if none is provided
		let direction: Direction = Direction.UP;
		if (orderObject == null) {
			return {direction: direction, keys: []};
		} else if (typeof orderObject === "string") {
			this.fieldParser.validateField(orderObject);
			return {direction: direction, keys: [orderObject]};
		} else if (typeof orderObject !== "object") {
			throw new InsightError("Invalid 'ORDER' provided.");
		}

		// Case that orderObject is an object
		// Ensuring orderObject has correct keys
		const orderObjectKeys: string[] = Object.keys(orderObject);
		if (!orderObjectKeys.includes("dir")) {
			throw new InsightError("Missing key 'dir' in 'ORDER'.");
		} else if (!orderObjectKeys.includes("keys")) {
			throw new InsightError("Missing key 'keys' in 'ORDER'.");
		} else if (orderObjectKeys.length !== 2) {
			throw new InsightError(`Expected 2 keys in 'ORDER' but got ${orderObjectKeys.length}.`);
		}

		// Ensuring orderKeys is non-empty array of strings
		const orderKeys: string[] = orderObject.keys;
		if (!(orderKeys instanceof Array) || orderKeys.length === 0 || typeof orderKeys[0] !== "string") {
			throw new InsightError(`'ORDER' must be an array of strings, but got '${typeof orderObject[0]}'`);
		}

		// Getting direction
		direction = util.getDirection(orderObject.dir);
		// Getting keys
		const keys: string[] = [];
		orderKeys.forEach((element) => {
			this.fieldParser.validateField(element);
			keys.push(element);
		});
		return {direction: direction, keys: keys
		};
	}

	// Parses the query's 'GROUP'
	private parseGroup(): Field[] {
		// First, validate group
		if (!this.query.TRANSFORMATIONS) {
			return [];
		}
		const group: Field[] = this.query.TRANSFORMATIONS.GROUP;
		if (!(group instanceof Array) || group.length === 0) {
			throw new InsightError("'GROUP' must be a non-empty array.");
		}

		// Then parse group
		const ret: Field[] = [];
		group.forEach((element: string) => {
			const field: Field = this.fieldParser.parseIdAndField(element).field;
			this.fieldParser.validateField(field);
			ret.push(field);
		});
		return ret;
	}

	// Parses the query's 'APPLY'
	private parseApply(): SingleApply[] {
		// First, validate APPLY
		if (!this.query.TRANSFORMATIONS) {
			return [];
		}
		const applyArray: any[] = this.query.TRANSFORMATIONS.APPLY;
		if (!(applyArray instanceof Array)) {
			throw new InsightError("Invalid 'APPLY' provided.");
		}

		// Then parse apply
		const ret: SingleApply[] = [];
		for (const outerObject of applyArray) {
			// Validating outerObject
			if (typeof outerObject !== "object" || Object.keys(outerObject).length !== 1) {
				throw new InsightError(`Invalid object '${outerObject}' in APPLY.`);
			}
			// Validating innerObject
			const innerObject: any = Object.values(outerObject)[0];
			if (typeof innerObject !== "object"
				|| Object.keys(innerObject).length !== 1
				|| typeof Object.values(innerObject)[0] !== "string") {
				throw new InsightError(`Invalid value '${innerObject}' in APPLY.`);
			}

			const newField: string = Object.keys(outerObject)[0];
			if (newField.includes("_")) {
				throw new InsightError(`'APPLY' key '${newField}' can not include '_' character.`);
			}
			const operation: ApplyOperation = util.getApplyOperation(Object.keys(innerObject)[0]);
			const targetField: Field = this.fieldParser.parseIdAndField(Object.values(innerObject)[0] as string).field;
			ret.push({newField: newField, operation: operation, targetField: targetField});
		}
		return ret;
	}
}
