import {InsightDatasetKind} from "../../IInsightFacade";
import FieldParserCourses from "./FieldParserCourses";
import FieldParser from "./FieldParser";
import FieldParserRooms from "./FieldParserRooms";

export default class FieldParserFactory{
	public static newParser(targetDatasetID: string, datasetKind: InsightDatasetKind): FieldParser {
		switch (datasetKind) {
			case InsightDatasetKind.Courses:
				return new FieldParserCourses(targetDatasetID);
			case InsightDatasetKind.Rooms:
				return new FieldParserRooms(targetDatasetID);
		}
	}
}
