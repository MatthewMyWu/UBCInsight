import {CourseSection, Room} from "../InsightFacade";
import {ApplyOperation, Direction, Field, SingleApply} from "./PerformQueryUtil";
import {InsightDatasetKind, InsightError, ResultTooLargeError} from "../IInsightFacade";
import FieldParser from "./Field Parsers/FieldParser";
import FieldParserFactory from "./Field Parsers/FieldParserFactory";
import PerformQueryHelper from "./PerformQueryHelper";
import Decimal from "decimal.js";

export default class ResultsFormatter {
	private readonly targetDatasetID: string;
	private readonly fieldParser: FieldParser;

	constructor(targetDatasetID: string, datasetKind: InsightDatasetKind) {
		this.targetDatasetID = targetDatasetID;
		this.fieldParser = FieldParserFactory.newParser(targetDatasetID, datasetKind);
	}

	public formatResults(input: CourseSection[] | Room[], columns: string[], direction: Direction, orderKeys: string[],
		group: Field[], applyKeys: SingleApply[]): CourseSection[] | Room[] {
		this.validateColumns(columns, group, applyKeys);
		let transformedElements: any[]; // list of dataEntries after transformations are applied
		if (group.length > 0) {
			// First we need to apply group
			const groupedElements: Map<any, CourseSection[] | Room[]> = this.applyGroup(input, group);
			// Then we need to handle applyKeys. This will also append targetDatasetID to all existing fields
			const appliedElements: any[] = this.applyApply(groupedElements, applyKeys);
			transformedElements = appliedElements;
		} else {
			// In this case, no transformations are provided so we just append datasetID
			transformedElements = this.appendDatasetID(input);
		}

		if (transformedElements.length > PerformQueryHelper.MAX_RESULTS) {
			throw new ResultTooLargeError();
		}

		// Ordering ret
		const orderedElements: any[] = this.orderSections(transformedElements, columns, direction, orderKeys);

		// Filter all sections to have the correct columns
		const filteredElements: any[] = [];
		orderedElements.forEach((dataEntry) => {
			filteredElements.push(this.filterColumns(dataEntry, columns));
		});
		return filteredElements;
	}

	// Validates that all columnKeys are contained in group or apply. Throws error if it doesn't
	private validateColumns(columns: string[], group: Field[], applyKeys: SingleApply[]) {
		if (group.length === 0 && applyKeys.length === 0) {
			return;
		}
		columns.forEach((column) => {
			// Search group
			try {
				if (group.includes(this.fieldParser.parseIdAndField(column).field)) {
					return;
				}
			} catch (e) {
				// Do nothing
			}
			// Search apply
			for (const singleApply of applyKeys) {
				if (column === singleApply.newField) {
					return;
				}
			}
			// Key not found, throw error
			throw new InsightError(`'${column}' key in COLUMNS must be present in GROUP or APPLY.`);
		});
	}

	// will return 'sections' ordered according to the ordering provided in "optionsObject"
	// Also needs to take in columns to check that the provided "order" is included in columns
	private orderSections(sections: any[], columns: string[], direction: Direction, orderKeys: string[]): any[] {
		// If no orderKeys provided, then just return
		if (orderKeys.length === 0) {
			return sections;
		}

		// Check that all 'orderKeys' keys are contained within columns
		for (const orderKey of orderKeys) {
			if (!columns.includes(orderKey)) {
				throw new InsightError(`Order key '${orderKeys}' is not included in columns.`);
			}
		}

		// Sort sections according to orderKeys
		sections.sort((first, second) => {
			for (const orderKey of orderKeys) {
				if (first[orderKey] === second[orderKey]) {
					continue;
				}
				if (direction === Direction.UP) {
					if (first[orderKey] > second[orderKey]) {
						return 1;
					} else if (first[orderKey] < second[orderKey]) {
						return -1;
					}
				} else if (direction === Direction.DOWN) {
					if (first[orderKey] > second[orderKey]) {
						return -1;
					} else if (first[orderKey] < second[orderKey]) {
						return 1;
					}
				}
			}
			return 0;
		});

		return sections;
	}

	// Returns the given 'section' which contains only the specified 'columns'
	// Also appends targetDatasetID to return value
	private filterColumns(dataEntry: any, columns: string[]): any {
		const ret: any = {};
		columns.forEach((field) => {
			ret[field] = dataEntry[field];
			// ret[`${this.targetDatasetID}_${field}`] = this.fieldParser.findFieldValue(dataEntry, field);
		});
		return ret;
	}

	// Given an array of objects, appends datasetID_ to the beginning of each key
	private appendDatasetID(input: any[]): any[] {
		const ret: any[] = [];
		input.forEach((element) => {
			const newEntry: any = {};
			for (const oldKey of Object.keys(element)) {
				newEntry[`${this.targetDatasetID}_${oldKey}`] = (element as any)[oldKey];
			}
			ret.push(newEntry);
		});
		return ret;
	}

	// Given an input of dataEntries, will organize them into groups
	private applyGroup(input: CourseSection[] | Room[], groupKeys: Field[]): Map<any, CourseSection[] | Room[]> {
		const ret: Map<any, any[]> = new Map<any, CourseSection[] | Room[]>();
		input.forEach((dataEntry: CourseSection | Room) => {
			// First, initialize the group key
			const groupKey: any = {};
			groupKeys.forEach((field: Field) => {
				groupKey[field] = this.fieldParser.findFieldValue(dataEntry, field);
			});

			// Then try and add this dataEntry to existing groupList in ret
			const groupList = getFromRet(groupKey);
			if (groupList) {
				groupList.push(dataEntry);
			} else {
				ret.set(groupKey, [dataEntry]);
			}
		});

		return ret;

		// Given a key, will search ret for the key using deep equality
		function getFromRet(inputKeyObject: any): any {
			for (const [mapKey, mapValue] of ret) {
				let matchFound: boolean = true;
				// First check if keys have same length
				if(Object.keys(inputKeyObject).length !== Object.keys(mapKey).length) {
					continue;
				}
				// Then check if objects contain same values
				for (const key of Object.keys(mapKey)) {
					if (inputKeyObject[key] !== mapKey[key]) {
						matchFound = false;
						break;
					}
				}
				if (matchFound) {
					return mapValue;
				}
			}
			// Case where targetKey is not found
			return undefined;
		}
	}

	// Given a map of grouped elements, evaluates and adds all of the applyKeys.
	// Also appends the datasetID to existing field elements (to avoid naming conflicts)
	private applyApply(groupedElements: Map<any, CourseSection[] | Room[]>, applyKeys: SingleApply[]): any[] {
		// This is return value. Keeps track of all the groups to return
		const retGroup: any[] = [];

		// Iterating over all input groups
		for (const [groupKey, groupList] of groupedElements) {
			// Keeps track of all "new" apply keys that will be added to the groupKey
			const newApplyKeys: any = {};
			// Creating new key for each singleApply
			for (const singleApply of applyKeys) {
				const applyValue: number = this.evaluateSingleApply(groupList, singleApply);
				newApplyKeys[singleApply.newField] = applyValue;
			}

			// Creating new group "key" (with new apply values and datasetID appended to existing fields)
			const newGroupKey: any = {};
			// First append datasetID to existing fields (to avoid key name conflicts)
			for (const field of Object.keys(groupKey)) {
				newGroupKey[`${this.targetDatasetID}_${field}`] = groupKey[field];
			}
			// Then add new apply keys
			for (const newApplyKey of Object.keys(newApplyKeys)) {
				newGroupKey[newApplyKey] = newApplyKeys[newApplyKey];
			}
			// Finally push onto retGroup
			retGroup.push(newGroupKey);
			if (retGroup.length > PerformQueryHelper.MAX_RESULTS) {
				throw new ResultTooLargeError();
			}
		}

		return retGroup;
	}

	// Will evaluate the singleApply against the groupList, and return the result of the apply (eg. avg, sum, max, min, count)
	private evaluateSingleApply(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		switch (singleApply.operation) {
			case ApplyOperation.MIN:
				return this.handleMin(groupList, singleApply);
			case ApplyOperation.MAX:
				return this.handleMax(groupList, singleApply);
			case ApplyOperation.AVG:
				return this.handleAvg(groupList, singleApply);
			case ApplyOperation.SUM:
				return this.handleSum(groupList, singleApply);
			case ApplyOperation.COUNT:
				return this.handleCount(groupList, singleApply);
			default:
				throw new InsightError(`Invalid apply operation '${singleApply.operation}' provided.`);
		}
	}

	// Helper function for evaluateSingleApply
	private handleCount(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		// Is a set of unique values of specified field (singleApply.targetField) present in groupList
		const uniqueValues: Set<string | number> = new Set<string | number>();
		groupList.forEach((element) => {
			uniqueValues.add(this.fieldParser.findFieldValue(element, singleApply.targetField));
		});
		return uniqueValues.size;
	}

	// Helper function for evaluateSingleApply
	private handleMin(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		let ret: number = Number.MAX_SAFE_INTEGER;
		if (!this.fieldParser.checkFieldValuePair(singleApply.targetField, 1)) {
			throw new InsightError(`Can not perform 'MIN' on '${singleApply.targetField}'.`);
		}
		for (const element of groupList) {
			ret = Math.min(ret, this.fieldParser.findFieldValue(element, singleApply.targetField) as number);
		}
		return ret;
	}

	// Helper function for evaluateSingleApply
	private handleMax(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		let ret: number = Number.MIN_SAFE_INTEGER;
		if (!this.fieldParser.checkFieldValuePair(singleApply.targetField, 1)) {
			throw new InsightError(`Can not perform 'MAX' on '${singleApply.targetField}'.`);
		}
		for (const element of groupList) {
			ret = Math.max(ret, this.fieldParser.findFieldValue(element, singleApply.targetField) as number);
		}
		return ret;
	}

	// Helper function for evaluateSingleApply
	private handleSum(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		let sum: number = 0;
		if (!this.fieldParser.checkFieldValuePair(singleApply.targetField, 1)) {
			throw new InsightError(`Can not perform 'SUM' on '${singleApply.targetField}'.`);
		}
		for (const element of groupList) {
			sum += this.fieldParser.findFieldValue(element, singleApply.targetField) as number;
		}
		return sum;
	}

	// Helper function for evaluateSingleApply
	private handleAvg(groupList: CourseSection[] | Room[], singleApply: SingleApply): number {
		let sum = new Decimal(0), count: number = 0;
		if (!this.fieldParser.checkFieldValuePair(singleApply.targetField, 1)) {
			throw new InsightError(`Can not perform 'AVG' on '${singleApply.targetField}'.`);
		}
		for (const element of groupList) {
			sum = sum.add(this.fieldParser.findFieldValue(element, singleApply.targetField) as number);
			count++;
		}
		return Number((sum.toNumber() / count).toFixed(2));
	}
}
