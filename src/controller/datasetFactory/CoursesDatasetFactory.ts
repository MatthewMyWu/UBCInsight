import InsightDatasetFactory from "./InsightDatasetFactory";
import {CourseSection, InsightDatasetImpl} from "../InsightFacade";
import JSZip, {JSZipObject} from "jszip";
import {InsightDatasetKind, InsightError} from "../IInsightFacade";

export default class CoursesDatasetFactory extends InsightDatasetFactory {
	public createDatasetFromZip(zip: string): Promise<InsightDatasetImpl> {
		// load zipped dataset
		const zippedDataset: Promise<JSZip> = new JSZip().loadAsync(zip, {base64: true});
		return zippedDataset
			.then(this.readSectionsFromDataset)
			.then((parsedContent: CourseSection[]) => {
				return {
					kind: InsightDatasetKind.Courses,
					content: parsedContent,
				} as InsightDatasetImpl;
			})
			.catch((err) => {
				// if promise is rejected, wrap it in an InsightError
				return Promise.reject(new InsightError(err.message));
			});
	}

	private readSectionsFromDataset(zip: JSZip): Promise<CourseSection[]> {
		// look for courses folder
		const coursesFolder = zip.folder("courses");
		if (coursesFolder === null) {
			throw new InsightError("courses folder not found in the dataset");
		}

		// parse each file into a list of sections
		const promises: Array<Promise<CourseSection[]>> = [];
		coursesFolder.forEach((relativePath: string, file: JSZipObject) => {
			promises.push(
				file
					.async("string")
					.then((fileString: string) => {
						return CoursesDatasetFactory.parseFileToSections(fileString);
					})
					.then((sections) => {
						return Promise.resolve(sections);
					})
					.catch((err) => {
						// skip it by resolving with an empty array
						return Promise.resolve([]);
					})
			);
		});

		// collect the sections and flatten them into one array
		return Promise.all(promises).then((sections: CourseSection[][]) => {
			const sectionsArray: CourseSection[] = sections.flat();
			if (sectionsArray.length === 0) {
				return Promise.reject(new InsightError("No valid sections were found in the JSON"));
			}
			return sectionsArray;
		});
	}

	// helper to read all the sections in a file and parse it into an array of sections
	private static parseFileToSections(fileString: string): Promise<CourseSection[]> {
		const rawCourseData: Array<Record<string, unknown>> = JSON.parse(fileString).result;
		if (rawCourseData.length === 0) {
			throw new InsightError("This file has no valid sections.");
		}
		const sections: CourseSection[] = [];
		for (let rawSectionJson of rawCourseData) {
			const dept: string = rawSectionJson.Subject as string;
			const id: string = (rawSectionJson.Course as number).toString();
			const avg: number = rawSectionJson.Avg as number;
			const instructor: string = rawSectionJson.Professor as string;
			const title: string = rawSectionJson.Title as string;
			const pass: number = rawSectionJson.Pass as number;
			const fail: number = rawSectionJson.Fail as number;
			const audit: number = rawSectionJson.Audit as number;
			const uuid: string = (rawSectionJson.id as number).toString();
			const year: number =
				rawSectionJson.Section === "overall" ? 1900 : parseInt(rawSectionJson.Year as string, 10);
			sections.push({
				dept: dept,
				id: id,
				avg: avg,
				instructor: instructor,
				title: title,
				pass: pass,
				fail: fail,
				audit: audit,
				uuid: uuid,
				year: year,
			} as CourseSection);
		}
		return Promise.resolve(sections);
	}
}
