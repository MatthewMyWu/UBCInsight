import {CourseSection, Room} from "../InsightFacade";
import {InsightDatasetKind, InsightError} from "../IInsightFacade";
import {Comparison, ComplexQuery, Logic, SingleQuery} from "./PerformQueryUtil";
import FieldParser from "./Field Parsers/FieldParser";
import FieldParserFactory from "./Field Parsers/FieldParserFactory";

// Contains all "evaluation" methods (to evaluate whether or not a given section satisfies a given set of queries
export default class PerformQueryEvaluate {
	private readonly fieldParser: FieldParser;

	constructor(targetDatasetID: string, kind: InsightDatasetKind) {
		this.fieldParser = FieldParserFactory.newParser(targetDatasetID, kind);
	}

	// Performs the given a "ComplexQuery" on the given Section.
	// Returns true if section satisfies query, false otherwise
	public evaluateComplexQuery(parsedQuery: ComplexQuery, section: CourseSection | Room): boolean {
		// Helper method to evaluate parsedQuery in the case that it's logic field is "OR".
		// Return true if section satisfied query, false otherwise
		const evaluateOr = () => {
			// Iterating over complex queries
			for (const complexQuery of parsedQuery.complexQueries) {
				if (this.evaluateComplexQuery(complexQuery, section)) {
					return true;
				}
			}
			// Iterating over single queries
			for (const singleQuery of parsedQuery.singleQueries) {
				if (this.evaluateSingleQuery(singleQuery, section)) {
					return true;
				}
			}
			// If valid satisfies no queries, return false
			return false;
		};

		// Helper method to evaluate parsedQuery in the case that it's logic field is "AND".
		// Return true if section satisfied query, false otherwise
		const evaluateAnd = () => {
			// Iterating over complex queries
			for (const complexQuery of parsedQuery.complexQueries) {
				if (!this.evaluateComplexQuery(complexQuery, section)) {
					return false;
				}
			}
			// Iterating over single queries
			for (const singleQuery of parsedQuery.singleQueries) {
				if (!this.evaluateSingleQuery(singleQuery, section)) {
					return false;
				}
			}
			// If all queries satisfied, return true
			return true;
		};

		let ret: boolean;
		if (parsedQuery.logic === Logic.OR) {
			ret = evaluateOr.call(this);
		} else if (parsedQuery.logic === Logic.AND) {
			ret = evaluateAnd.call(this);
		} else {
			throw new Error("Unexpected Error. Complex Query logic was not 'AND' nor 'OR'.");
		}

		return parsedQuery.negation ? !ret : ret;
	}

	// Performs the given a "SingleQuery" on the given Section. Returns true if section satisfies query, false otherwise
	public evaluateSingleQuery(singleQuery: SingleQuery, dataEntry: CourseSection | Room): boolean {
		const dataEntryElement: number | string = this.fieldParser.findFieldValue(dataEntry, singleQuery.field);
		let ret: boolean;
		switch (singleQuery.comparison) {
			case Comparison.LT:
				ret = dataEntryElement < singleQuery.value;
				break;
			case Comparison.GT:
				ret = dataEntryElement > singleQuery.value;
				break;
			case Comparison.EQ:
				ret = dataEntryElement === singleQuery.value;
				break;
			case Comparison.IS:
				if (typeof dataEntryElement === "string") {
					ret = this.evaluateIs(singleQuery.value, dataEntryElement);
				} else {
					throw new InsightError(`Expected '${singleQuery.field}' to be a string, but got
				${typeof dataEntryElement}.`);
				}
				break;
			default:
				throw new InsightError("Invalid comparison provided");
		}

		return singleQuery.negation ? !ret : ret;
	}

	// Returns true if "stringFromData" matches "stringFromQuery" (accounting for wildcard usage), false otherwise
	// Intended to be used for "IS" comparisons
	private evaluateIs(stringFromQuery: string, stringFromData: string): boolean {
		// First, check that there are no invalid asterisks in middle of string
		if (stringFromQuery.length >= 3 && stringFromQuery.substring(1, stringFromQuery.length - 1).includes("*")) {
			throw new InsightError(`Input '${stringFromQuery} is invalid. Asterisk can only be at beginning or
			end of string.`);
		}

		// Constructing regexp
		// First "fix" the (potential) asterisks at beginning and end of string
		if (stringFromQuery[stringFromQuery.length - 1] === "*") {
			stringFromQuery = stringFromQuery.substring(0, stringFromQuery.length - 1) + ".*";
		}
		if (stringFromQuery[0] === "*") {
			stringFromQuery = "." + stringFromQuery;
		}
		// Then assert "anchors" for beginning and end of string
		stringFromQuery = "^" + stringFromQuery + "$";
		const matchString = new RegExp(stringFromQuery);

		// Evaluating regexp
		return matchString.test(stringFromData);
	}
}
