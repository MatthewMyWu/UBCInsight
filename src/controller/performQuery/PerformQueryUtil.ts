import {InsightError} from "../IInsightFacade";
import {CourseField} from "./Field Parsers/FieldParserCourses";
import {RoomField} from "./Field Parsers/FieldParserRooms";

// Enumeration of all "FIELD" values that input can have
export type Field = CourseField | RoomField;

// Enumeration of all "COMPARISON" keys that can be in input
export enum Comparison {
	LT = "LT",
	GT = "GT",
	EQ = "EQ",
	IS = "IS",
}

// Enumeration of all "LOGIC" keys that can be in input
export enum Logic {
	AND = "AND",
	OR = "OR",
	NOT = "NOT",
}

// Enumeration of all possible directions of sorting
export enum Direction {
	UP = "UP",
	DOWN = "DOWN"
}

// Enumeration of all possible operations that can be used in "APPLY"
// String representations are how they should be included in query
export enum ApplyOperation {
	MAX = "MAX",
	AVG = "AVG",
	MIN = "MIN",
	SUM = "SUM",
	COUNT = "COUNT"
}

// Structure for a single query (ex. LT, GT, EQ, IS)
export interface SingleQuery {
	kind: "SingleQuery";
	field: Field;
	comparison: Comparison;
	value: any;
	negation: boolean;
}

// Structure for a complex query (ex. "AND" or "OR', which can hold multiple queries)
export interface ComplexQuery {
	kind: "ComplexQuery";
	complexQueries: ComplexQuery[];
	singleQueries: SingleQuery[];
	logic: Logic;
	negation: boolean;
}

// Structure for an single apply 'key'
// Creates the "newField" by applying "operation" on "targetField"
export interface SingleApply {
	newField: string,
	operation: ApplyOperation,
	targetField: Field
}

export interface Map {
	deepGet(key: any): any;
}

// This class contains utility functions for PerformQueryHelper.
// Contains type/enum/interface definitions and their respective getters
export default abstract class PerformQueryUtil {

	// converts a string into Logic key
	public static getLogic(key: string): Logic {
		switch (key) {
			case Logic.NOT:
				return Logic.NOT;
			case Logic.AND:
				return Logic.AND;
			case Logic.OR:
				return Logic.OR;
			default:
				throw new InsightError(`Invalid logic key '${key}' provided.`);
		}
	}

	// converts a string into comparison
	public static getComparison(key: string): Comparison {
		switch (key) {
			case Comparison.GT:
				return Comparison.GT;
			case Comparison.EQ:
				return Comparison.EQ;
			case Comparison.LT:
				return Comparison.LT;
			case Comparison.IS:
				return Comparison.IS;
			default:
				throw new InsightError(`Invalid comparison key '${key}' provided.`);
		}
	}

	// Converts a string into a Direction
	public static getDirection(key: string): Direction {
		switch (key) {
			case Direction.UP:
				return Direction.UP;
			case Direction.DOWN:
				return Direction.DOWN;
			default:
				throw new InsightError(`Invalid Direction '${key}' provided.`);
		}
	}

	// Converts a string into an ApplyOperations
	public static getApplyOperation(key: string): ApplyOperation {
		switch (key) {
			case ApplyOperation.AVG:
				return ApplyOperation.AVG;
			case ApplyOperation.MIN:
				return ApplyOperation.MIN;
			case ApplyOperation.MAX:
				return ApplyOperation.MAX;
			case ApplyOperation.SUM:
				return ApplyOperation.SUM;
			case ApplyOperation.COUNT:
				return ApplyOperation.COUNT;
			default:
				throw new InsightError(`Invalid Apply Operation '${key}' provided.`);
		}
	}

	// simple check for typeof Comparison
	public static isComparison(input: any): input is Comparison {
		for (const value in Comparison) {
			if (input === value) {
				return true;
			}
		}
		return false;
	}

	// simple check for typeof Logic
	public static isLogic(input: any): input is Logic {
		for (const value in Logic) {
			if (input === value) {
				return true;
			}
		}
		return false;
	}
}
