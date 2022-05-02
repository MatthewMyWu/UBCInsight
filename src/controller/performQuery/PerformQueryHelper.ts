import {InsightError} from "../IInsightFacade";
import {InsightDatasetImpl} from "../InsightFacade";
import {ComplexQuery, Direction, Field, SingleApply, SingleQuery} from "./PerformQueryUtil";
import PerformQueryEvaluate from "./PerformQueryEvaluate";
import QueryParser from "./QueryParser";
import ResultsFormatter from "./ResultsFormatter";

// Helper class for performQuery
// Should check that query contains valid keys. Implementation should not be different based on Dataset kind
// An instance to this is specific to a query
export default class PerformQueryHelper {
	// Max number of results that can be returned by query
	public static MAX_RESULTS: number = 5000;
	// Record of all possible datasets
	private readonly allDatasets: Record<string, InsightDatasetImpl>;
	// The query that this helper is responsible for
	private readonly query: any;

	// Keeps track of id of current dataset (should be set once and not changed)
	private readonly targetDatasetID: string;
	// The "target" dataset that the query is performed on.
	private readonly targetDataset: InsightDatasetImpl;
	// object used to parse the query
	private readonly queryParser: QueryParser;
	// object used to format results
	private readonly resultsFormatter: ResultsFormatter;
	// object used to evaluate dataEntries against queries
	private readonly evaluator: PerformQueryEvaluate;


	constructor(allDatasets: Record<string, InsightDatasetImpl>, query: any) {
		this.allDatasets = allDatasets;
		this.query = query;
		// First, check if query contains proper keys
		this.queryKeysCheck(this.query);

		// Use query "OPTIONS.COLUMNS" to access datasetID
		const columns: any = query.OPTIONS.COLUMNS;

		// Check that columns is non-empty string array
		if (!Array.isArray(columns) || !(columns.length > 0) || typeof columns[0] !== "string") {
			throw new InsightError("Expected 'COLUMNS' to be a non-empty string array but got" +
				`'${typeof query.OPTIONS.COLUMNS}'`);
		}

		// Check that first input in columns is valid
		const splitInput: string[] = columns[0].split("_");
		if (splitInput.length !== 2) {
			throw new InsightError(`Invalid value '${columns[0]}' in columns.`);
		}

		// Initializing fields
		this.targetDatasetID = splitInput[0];
		this.targetDataset = this.getDatasetImpl(this.targetDatasetID);
		this.queryParser = new QueryParser(this.targetDatasetID, this.targetDataset.kind, query);
		this.resultsFormatter = new ResultsFormatter(this.targetDatasetID, this.targetDataset.kind);
		this.evaluator = new PerformQueryEvaluate(this.targetDatasetID, this.targetDataset.kind);
	}

	// Performs the query
	public performQuery(): Promise<any[]> {
		try {
			// Initialize variables
			let ret: any[] = [];
			const parsedQuery: SingleQuery | ComplexQuery | undefined = Object.keys(this.query.WHERE).length > 0 ?
				this.queryParser.parseWhere() : undefined;

			const options: any = this.queryParser.parseOptions();
			const columns: string[] = options.columns;
			const direction: Direction = options.direction;
			const orderKeys: string[] = options.keys;

			const transformations: any = this.queryParser.parseTransformations();
			const group: Field[] = transformations.group;
			const applyKeys: SingleApply[] = transformations.applyKeys;

			// Evaluating the parsedQuery against each dataEntry
			this.targetDataset.content.forEach((dataEntry) => {
				// Check if dataEntry is valid against parsedQuery. Skip if it doesn't
				if (parsedQuery) {
					let validSection: boolean;
					if (parsedQuery.kind === "SingleQuery") {
						validSection = this.evaluator.evaluateSingleQuery(parsedQuery, dataEntry);
					} else if (parsedQuery.kind === "ComplexQuery") {
						validSection = this.evaluator.evaluateComplexQuery(parsedQuery, dataEntry);
					} else {
						throw new Error("Unexpected Error. Query was not 'SingleQuery' nor 'ComplexQuery'.");
					}

					if (!validSection) {
						return;
					}
				}

				// Adding the section to ret
				ret.push(dataEntry);
			});

			// Sorting the array according to ORDER
			ret = this.resultsFormatter.formatResults(ret, columns, direction, orderKeys, group, applyKeys);
			return Promise.resolve(ret);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// Takes in the entire query and checks that it contains valid keys (WHERE, OPTIONS, COLUMNS, and ORDER)
	// Additionally checks that TRANSFORMATIONS has correct keys if present
	// Throws error if invalid keys
	private queryKeysCheck(query: any): void {
		// Checking that query is non null
		if (!query || typeof query !== "object") {
			throw new InsightError(`Expected query to be object but got ${typeof query} instead.`);
		}

		// First check that the query contains WHERE and OPTIONS, and optionally GROUP and TRANSFORM
		if (!checkExpectedKeys(query, ["WHERE", "OPTIONS"]) &&
			!checkExpectedKeys(query, ["WHERE", "OPTIONS", "TRANSFORMATIONS"])) {
			throw new InsightError("Query keys are invalid");
		}

		// Then check that OPTIONS contains COLUMNS and (optionally) ORDER
		if (!checkExpectedKeys(query.OPTIONS, ["COLUMNS"]) &&
			!checkExpectedKeys(query.OPTIONS, ["COLUMNS", "ORDER"])) {
			throw new InsightError("OPTIONS keys are invalid");
		}

		// If TRANSFORMATIONS is present, check that it contains both "GROUP" and APPLY
		if (query.TRANSFORMATIONS && !checkExpectedKeys(query.TRANSFORMATIONS, ["GROUP", "APPLY"])) {
			throw new InsightError("TRANSFORMATIONS keys are invalid");
		}

		// Returns true if object contains expected keys (and no extras). False otherwise.
		function checkExpectedKeys(object: any, expectedKeys: string[]): boolean {
			const objectKeys: string[] = Object.keys(object);
			// checking all expected keys are present
			for (const requiredKey of expectedKeys) {
				if (!objectKeys.includes(requiredKey) || object[requiredKey] === null) {
					return false;
				}
			}
			// checking there are no extra keys and returning
			return objectKeys.length === expectedKeys.length;
		}
	}

	// Given a "targetID", will return the "allDatasets" entry for that targetID
	private getDatasetImpl(targetID: string): InsightDatasetImpl {
		if (Object.keys(this.allDatasets).includes(targetID)) {
			return this.allDatasets[targetID];
		} else {
			throw new InsightError(`Dataset ID '${targetID}' does not exist.`);
		}
	}
}
