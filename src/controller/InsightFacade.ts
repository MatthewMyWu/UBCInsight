import {IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, NotFoundError} from "./IInsightFacade";
import PerformQueryHelper from "./performQuery/PerformQueryHelper";

import * as fs from "fs-extra";
import InsightDatasetFactory from "./datasetFactory/InsightDatasetFactory";
import CoursesDatasetFactory from "./datasetFactory/CoursesDatasetFactory";
import RoomsDatasetFactory from "./datasetFactory/RoomsDatasetFactory";

export interface InsightDatasetImpl {
	kind: InsightDatasetKind;
	content: CourseSection[] | Room[];
}

export interface CourseSection {
	dept: string;
	id: string;
	avg: number;
	instructor: string;
	title: string;
	pass: number;
	fail: number;
	audit: number;
	uuid: string;
	year: number;
}

export interface Room {
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private static readonly PERSIST_DIR: string = "./data";

	private datasets: Record<string, InsightDatasetImpl> = {};

	// not used, it's here in case we want to wait until the datasets are loaded from disk before making any queries
	private isLoaded: Promise<any>;

	constructor() {
		// console.trace("InsightFacadeImpl::init()");
		this.isLoaded = fs
			.ensureDir(InsightFacade.PERSIST_DIR)
			.then(() => {
				return fs.readdir(InsightFacade.PERSIST_DIR);
			})
			.then((files: string[]) => {
				// load any existing data files that are there
				const promises: Array<Promise<void>> = [];
				for (const file of files) {
					promises.push(
						fs.readFile(InsightFacade.PERSIST_DIR + "/" + file, "utf-8").then((data: string) => {
							const datasetId = file.substring(0, file.indexOf("."));
							this.datasets[datasetId] = JSON.parse(data);
						})
					);
				}
				return Promise.all(promises);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!InsightFacade.checkValidID(id)) {
			return Promise.reject(new InsightError("Invalid dataset ID."));
		}

		return this.isLoaded.then(() => {
			// check if id already exists as a key in datasets
			if (Object.prototype.hasOwnProperty.call(this.datasets, id)) {
				return Promise.reject(new InsightError("Duplicate dataset ID was added."));
			}

			let factory: InsightDatasetFactory;
			switch (kind) {
				case InsightDatasetKind.Courses:
					factory = new CoursesDatasetFactory();
					break;
				case InsightDatasetKind.Rooms:
					factory = new RoomsDatasetFactory();
					break;
			}

			return factory
				.createDatasetFromZip(content)
				.then((dataset: InsightDatasetImpl) => {
					this.datasets[id] = dataset;
					return InsightFacade.writeDatasetToPersistence(id, dataset);
				})
				.then(() => {
					return Object.keys(this.datasets);
				})
				.catch((err) => {
					// if promise is rejected, wrap it in an InsightError
					return Promise.reject(new InsightError(err.message));
				});
		});
	}

	// helper to write the sections to disk
	private static writeDatasetToPersistence(id: string, dataset: InsightDatasetImpl): Promise<void> {
		const fileName = InsightFacade.getDatasetFilename(id);
		return fs.outputJson(fileName, dataset);
	}

	public removeDataset(id: string): Promise<string> {
		if (!InsightFacade.checkValidID(id)) {
			return Promise.reject(new InsightError("Invalid dataset ID."));
		}
		return this.isLoaded.then(() => {
			// check if id exists as a key in datasets
			if (!Object.prototype.hasOwnProperty.call(this.datasets, id)) {
				return Promise.reject(new NotFoundError("Dataset ID was not found."));
			}
			// remove from disk and then remove from memory
			const fileName = InsightFacade.getDatasetFilename(id);
			return fs.unlink(fileName).then(() => {
				delete this.datasets[id];
				return id;
			});
		});
	}

	public listDatasets(): Promise<InsightDataset[]> {
		return this.isLoaded.then(() => {
			const datasetArray: InsightDataset[] = [];
			for (const [key, value] of Object.entries(this.datasets)) {
				datasetArray.push({
					id: key,
					kind: value.kind,
					numRows: value.content.length,
				} as InsightDataset);
			}
			return Promise.resolve(datasetArray);
		});
	}

	public performQuery(query: any): Promise<any[]> {
		return this.isLoaded.then(() => {
			try {
				const helper: PerformQueryHelper = new PerformQueryHelper(this.datasets, query);
				return helper.performQuery();
			} catch (error) {
				return Promise.reject(error);
			}
		});
	}

	// returns true if this is a valid ID, false otherwise
	public static checkValidID(id: string): boolean {
		return !id.includes("_") && id.trim().length > 0;
	}

	private static getDatasetFilename(id: string) {
		return `${InsightFacade.PERSIST_DIR}/${id}.json`;
	}
}
