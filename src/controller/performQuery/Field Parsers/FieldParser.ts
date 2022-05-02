import {CourseSection, Room} from "../../InsightFacade";
import {InsightError} from "../../IInsightFacade";
import {Field} from "../PerformQueryUtil";

export default abstract class FieldParser {
	protected readonly targetDatasetID: string;

	constructor(targetDatasetID: string) {
		this.targetDatasetID = targetDatasetID;
	}

	// Given a dataEntry, return the value of the specified field
	public findFieldValue(dataEntry: CourseSection | Room, field: Field): string | number {
		// Check that dataEntry and field are of the right types
		if (!this.isValidDataEntry(dataEntry)) {
			throw new Error(`Invalid data entry '${dataEntry}' provided.`);
		} else if (!this.isValidField(field)) {
			throw new InsightError(`Invalid field '${field}' provided.`);
		}

		return this.findFieldValueHelper(dataEntry, field);
	}

	protected abstract findFieldValueHelper(dataEntry: CourseSection | Room, field: Field): string | number;

	// Checks that the provided 'value' is of the correct type for the provided 'field'
	public abstract checkFieldValuePair(field: Field, value: any): boolean;

	// Given a string of the form "id_field", parses and returns the id and field.
	// Also checks that id and field are valid
	public parseIdAndField(input: string): {id: string; field: Field} {
		// Type check on input
		if (typeof input !== "string") {
			throw new InsightError(`Expected field to be string but got '${input}' instead.`);
		}

		// Splitting id
		const splitInput: string[] = input.split("_");
		if (splitInput.length !== 2) {
			throw new InsightError(`Expect exactly 1 '_' in key '${input}'.`);
		}
		// Getting id and field
		const id: string = splitInput[0];
		const field: Field = this.getField(splitInput[1]);

		// Check that dataset ID matches
		if (this.targetDatasetID !== id) {
			throw new InsightError(`Multiple dataset IDs '${this.targetDatasetID}' and '${id}' provided.`);
		}

		// returning
		return {
			id: id,
			field: field,
		};
	}

	// Throws an error if field is invalid (eg. if it references multiple datasets).
	// Otherwise do nothing
	public validateField(field: string): void {
		if (field.length === 0 ) {
			throw new InsightError("Can not have empty string as field.");
		}

		// If this is a dataset key, check that it is a valid key
		if (field.includes("_")) {
			// Throws an error if invalid
			this.parseIdAndField(field);
		}
	}

	// Checks if the given field is valid
	protected isValidField(key: string): key is Field {
		try {
			const field: Field = this.getField(key);
			// If no error is thrown, then field is valid
			return true;
		} catch(e) {
			// If error is thrown, then field is invalid
			return false;
		}
	}

	// converts a string into Field. Throws error if the key is not a valid Field
	protected abstract getField(key: string): Field;

	protected abstract isValidDataEntry(dataEntry: CourseSection | Room): dataEntry is CourseSection | Room;
}
