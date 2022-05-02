import {InsightError} from "../../IInsightFacade";
import {Room} from "../../InsightFacade";
import FieldParser from "./FieldParser";

// Enumeration of all "FIELD" values that a room may have
export enum RoomField {
	fullname = "fullname",
	shortname = "shortname",
	number = "number",
	name = "name",
	address = "address",
	lat = "lat",
	lon = "lon",
	seats = "seats",
	type = "type",
	furniture = "furniture",
	href = "href",
}

// Implementation of PerformQueryUtil if the dataset is of type "ROOMS"
export default class FieldParserRooms extends FieldParser {

	protected override findFieldValueHelper(dataEntry: Room, field: RoomField): string | number {
		return dataEntry[field];
	}

	// Checks that the provided 'value' is of the correct type for the provided 'field'
	public override checkFieldValuePair(field: RoomField, value: any): boolean {
		switch (field) {
			case RoomField.fullname:
			case RoomField.shortname:
			case RoomField.number:
			case RoomField.name:
			case RoomField.address:
			case RoomField.furniture:
			case RoomField.type:
			case RoomField.href:
				return typeof value === "string";
			case RoomField.seats:
			case RoomField.lat:
			case RoomField.lon:
				return typeof value === "number";
			default:
				return false;
		}
	}

	// Returns true if "key" is a valid rooms field
	protected override isValidField(key: string): key is RoomField {
		return super.isValidField(key);
	}

	// Returns true if "dataEntry" is a valid Room
	protected override isValidDataEntry(dataEntry: any): dataEntry is Room {
		const entryValues = Object.keys(dataEntry);
		for (const element of Object.values(RoomField)) {
			if (!entryValues.includes(element)) {
				return false;
			}
		}
		return true;
	}

	// converts a string into Field
	protected override getField(key: string): RoomField {
		switch (key) {
			case RoomField.fullname:
				return RoomField.fullname;
			case RoomField.shortname:
				return RoomField.shortname;
			case RoomField.number:
				return RoomField.number;
			case RoomField.name:
				return RoomField.name;
			case RoomField.address:
				return RoomField.address;
			case RoomField.lat:
				return RoomField.lat;
			case RoomField.lon:
				return RoomField.lon;
			case RoomField.seats:
				return RoomField.seats;
			case RoomField.type:
				return RoomField.type;
			case RoomField.furniture:
				return RoomField.furniture;
			case RoomField.href:
				return RoomField.href;
			default:
				throw new InsightError(`Invalid field value '${key}' provided.`);
		}
	}
}
