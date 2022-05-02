import InsightDatasetFactory from "./InsightDatasetFactory";
import {InsightDatasetImpl, Room} from "../InsightFacade";
import JSZip, {JSZipObject} from "jszip";
import parse5, {Element, TextNode} from "parse5";
import {InsightDatasetKind, InsightError} from "../IInsightFacade";
import * as http from "http";

interface Building {
	fullname: string;
	address: string;
	shortname: string;
	lat: number;
	lon: number;
}

interface ApiResult {
	lat?: number;
	lon?: number;
	error?: string;
}
export default class RoomsDatasetFactory extends InsightDatasetFactory {
	private static readonly API_URL = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team091/";

	public createDatasetFromZip(zip: string): Promise<InsightDatasetImpl> {
		// load zipped dataset
		const zippedDataset: Promise<JSZip> = new JSZip().loadAsync(zip, {base64: true});
		return zippedDataset
			.then(this.readRoomsFromDataset)
			.then((parsedContent: Room[]) => {
				return {
					kind: InsightDatasetKind.Rooms,
					content: parsedContent,
				} as InsightDatasetImpl;
			})
			.catch((err) => {
				// if promise is rejected, wrap it in an InsightError
				return Promise.reject(new InsightError(err.message));
			});
	}

	private async readRoomsFromDataset(zip: JSZip): Promise<Room[]> {
		const roomsFolder: JSZip | null = zip.folder("rooms");
		if (roomsFolder === null) {
			throw new InsightError("rooms folder not found in the dataset");
		}
		const indexFileTree: parse5.Document = parse5.parse(await RoomsDatasetFactory.readIndexFile(roomsFolder));

		const buildingPromises: Array<Promise<Building | null>> = RoomsDatasetFactory.searchIndexTree(indexFileTree);

		const roomPromises: Array<Promise<Room[]>> = [];
		(await Promise.all(buildingPromises)).forEach((building: Building | null) => {
			if (building !== null) {
				roomPromises.push(RoomsDatasetFactory.getRoomsForBuilding(roomsFolder, building));
			}
		});

		return Promise.all(roomPromises).then((rooms: Room[][]) => {
			const roomsArray: Room[] = rooms.flat();
			if (roomsArray.length === 0) {
				return Promise.reject(new InsightError("No valid rooms were found in the JSON"));
			}
			return roomsArray;
		});
	}

	private static readIndexFile(zip: JSZip): Promise<string> {
		const indexFile: JSZipObject | null = zip.file("index.htm");
		if (indexFile === null) {
			return Promise.reject(new InsightError("index.htm not found in the zip file"));
		}
		return indexFile.async("string");
	}

	private static searchIndexTree(node: parse5.ParentNode): Array<Promise<Building | null>> {
		let buildings: Array<Promise<Building | null>> = [];
		for (const child of node.childNodes) {
			if (this.isParentNode(child)) {
				if (this.isElementNode(child) && RoomsDatasetFactory.isTableRowForData(child)) {
					const building: Promise<Building | null> = RoomsDatasetFactory.readBuildingFromTableRow(child);
					buildings.push(building);
				} else {
					buildings = buildings.concat(RoomsDatasetFactory.searchIndexTree(child));
				}
			}
		}
		return buildings;
	}

	private static isTableRowForData(node: parse5.Element): boolean {
		if (node.tagName === "tr" && node.attrs.length > 0) {
			const classes: string[] = node.attrs[0].value.split(" ");
			return classes.includes("odd") || classes.includes("even");
		}
		return false;
	}

	private static readBuildingFromTableRow(node: parse5.Element): Promise<Building | null> {
		let fullname: string | null = null;
		let address: string | null = null;
		let shortname: string | null = null;

		for (let child of node.childNodes) {
			if (this.isElementNode(child) && child.tagName === "td") {
				const classes: string[] = child.attrs[0].value.split(" ");

				if (classes.includes("views-field-field-building-code")) {
					shortname = (child.childNodes[0] as TextNode).value.trim();
				} else if (classes.includes("views-field-field-building-address")) {
					address = (child.childNodes[0] as TextNode).value.trim();
				} else if (classes.includes("views-field-title")) {
					fullname = ((child.childNodes[1] as Element).childNodes[0] as TextNode).value.trim();
				}
			}
		}

		if (fullname != null && address != null && shortname != null) {
			return RoomsDatasetFactory.getLatAndLonForAddress(address)
				.then((arr: number[]) => {
					const lat: number = arr[0];
					const lon: number = arr[1];
					return {
						fullname: fullname,
						address: address,
						shortname: shortname,
						lat: lat,
						lon: lon,
					} as Building;
				})
				.catch(() => {
					return null;
				});
		}
		return Promise.resolve(null);
	}

	private static isParentNode(node: parse5.Node): node is parse5.ParentNode {
		return "childNodes" in node;
	}

	private static isElementNode(node: parse5.Node): node is parse5.Element {
		return this.isParentNode(node) && "tagName" in node;
	}

	private static getLatAndLonForAddress(address: string): Promise<number[]> {
		let url = this.API_URL + encodeURIComponent(address);
		return new Promise((resolve, reject) => {
			http.get(url, (response) => {
				let data: string[] = [];

				response.on("data", (fragments) => {
					data.push(fragments);
				});

				response.on("end", () => {
					const result = JSON.parse(data.join("")) as ApiResult;
					if (result.lat !== undefined && result.lon !== undefined) {
						resolve([result.lat, result.lon]);
					} else {
						reject(result.error);
					}
				});

				response.on("error", (error: Error) => {
					// promise rejected on error
					reject(error);
				});
			});
		});
	}

	private static async getRoomsForBuilding(roomsFolder: JSZip, building: Building): Promise<Room[]> {
		const regex = new RegExp(".*/" + building.shortname + "$");
		const files: JSZipObject[] = roomsFolder.file(regex);
		if (files.length === 0) {
			return Promise.resolve([]);
		}
		const roomsTree = parse5.parse(await files[0].async("string"));
		return Promise.all(this.searchRoomsTree(roomsTree, building)).then((possibleRooms: Array<Room | null>) => {
			const rooms: Room[] = [];
			for (let possibleRoom of possibleRooms) {
				if (possibleRoom !== null) {
					rooms.push(possibleRoom);
				}
			}
			return rooms;
		});
	}

	private static searchRoomsTree(node: parse5.ParentNode, building: Building): Array<Promise<Room | null>> {
		let rooms: Array<Promise<Room | null>> = [];
		for (const child of node.childNodes) {
			if (this.isParentNode(child)) {
				if (this.isElementNode(child) && RoomsDatasetFactory.isTableRowForData(child)) {
					const room: Promise<Room | null> = RoomsDatasetFactory.readRoomFromTableRow(child, building);
					rooms.push(room);
				} else {
					rooms = rooms.concat(RoomsDatasetFactory.searchRoomsTree(child, building));
				}
			}
		}
		return rooms;
	}

	private static readRoomFromTableRow(node: Element, building: Building): Promise<Room | null> {
		let number: string | null = null;
		let seats: number | null = null;
		let type: string | null = null;
		let furniture: string | null = null;
		let href: string | null = null;

		for (let child of node.childNodes) {
			if (this.isElementNode(child) && child.tagName === "td") {
				const classes: string[] = child.attrs[0].value.split(" ");

				if (classes.includes("views-field-field-room-number")) {
					number = ((child.childNodes[1] as Element).childNodes[0] as TextNode).value.trim();
				} else if (classes.includes("views-field-field-room-capacity")) {
					seats = parseInt((child.childNodes[0] as TextNode).value.trim(), 10);
				} else if (classes.includes("views-field-field-room-furniture")) {
					furniture = (child.childNodes[0] as TextNode).value.trim();
				} else if (classes.includes("views-field-field-room-type")) {
					type = (child.childNodes[0] as TextNode).value.trim();
				} else if (classes.includes("views-field-nothing")) {
					href = (child.childNodes[1] as Element).attrs[0].value;
				}
			}
		}
		if (number != null && seats != null && type != null && furniture != null && href != null) {
			return Promise.resolve({
				fullname: building.fullname,
				shortname: building.shortname,
				number: number,
				name: building.shortname + "_" + number,
				address: building.address,
				lat: building.lat,
				lon: building.lon,
				seats: seats,
				type: type,
				furniture: furniture,
				href: href,
			} as Room);
		}
		return Promise.resolve(null);
	}
}
