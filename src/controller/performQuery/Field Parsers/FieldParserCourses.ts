import {InsightError} from "../../IInsightFacade";
import {CourseSection} from "../../InsightFacade";
import FieldParser from "./FieldParser";

// Enumeration of all "FIELD" values that a course may have
export enum CourseField {
	avg = "avg",
	pass = "pass",
	fail = "fail",
	audit = "audit",
	year = "year",
	dept = "dept",
	id = "id",
	instructor = "instructor",
	title = "title",
	uuid = "uuid",
}

// Implementation of PerformQueryUtil if the dataset is of type "COURSES"
export default class FieldParserCourses extends FieldParser {

	protected override findFieldValueHelper(dataEntry: CourseSection, field: CourseField): string | number {
		return dataEntry[field];
	}

	// Checks that the provided 'value' is of the correct type for the provided 'field'
	public override checkFieldValuePair(field: CourseField, value: any): boolean {
		switch (field) {
			case CourseField.avg:
			case CourseField.pass:
			case CourseField.fail:
			case CourseField.audit:
			case CourseField.year:
				return typeof value === "number";
			case CourseField.dept:
			case CourseField.id:
			case CourseField.instructor:
			case CourseField.title:
			case CourseField.uuid:
				return typeof value === "string";
			default:
				return false;
		}
	}

	// Returns true if "key" is a valid CourseField
	protected override isValidField(key: string): key is CourseField {
		return super.isValidField(key);
	}

	// Returns true if "dataEntry" is a valid CourseSection
	protected isValidDataEntry(dataEntry: any): dataEntry is CourseSection {
		const entryValues = Object.keys(dataEntry);
		for (const element of Object.values(CourseField)) {
			if (!entryValues.includes(element)) {
				return false;
			}
		}
		return true;
	}

	// converts a string into Field.
	protected override getField(key: string): CourseField {
		switch (key) {
			case CourseField.avg:
				return CourseField.avg;
			case CourseField.pass:
				return CourseField.pass;
			case CourseField.fail:
				return CourseField.fail;
			case CourseField.audit:
				return CourseField.audit;
			case CourseField.year:
				return CourseField.year;
			case CourseField.dept:
				return CourseField.dept;
			case CourseField.id:
				return CourseField.id;
			case CourseField.instructor:
				return CourseField.instructor;
			case CourseField.title:
				return CourseField.title;
			case CourseField.uuid:
				return CourseField.uuid;
			default:
				throw new InsightError(`Invalid field key '${key}' provided.`);
		}
	}
}
