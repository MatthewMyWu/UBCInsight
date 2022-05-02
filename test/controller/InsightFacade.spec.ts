import {
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import * as fs from "fs-extra";
import {testFolder} from "@ubccpsc310/folder-test";
import chai, {expect} from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

describe("InsightFacade", function () {
	let insightFacade: InsightFacade;
	const persistDir = "./data";
	const datasetContents = new Map<string, string>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		courses: "./test/resources/archives/courses.zip",
		smallSample: "./test/resources/archives/smallCourses.zip",
		emptyDirectory: "./test/resources/archives/emptyDirectory.zip",
		invalidDirectory: "./test/resources/archives/invalidDirectory.zip",
		invalidFile: "./test/resources/archives/invalidFile.zip",
		rooms: "./test/resources/archives/rooms.zip",
	};

	let courseContent: string,
		smallContent: string,
		emptyContent: string,
		invalidContent: string,
		invalidFileContent: string,
		roomsContent: string;
	const myData: InsightDataset = {
		id: "courses",
		kind: InsightDatasetKind.Courses,
		numRows: 3,
	};
	const myData2: InsightDataset = {
		id: "courses2",
		kind: InsightDatasetKind.Courses,
		numRows: 3,
	};
	const myData3: InsightDataset = {
		id: "courses3",
		kind: InsightDatasetKind.Courses,
		numRows: 3,
	};

	const roomsData: InsightDataset = {
		id: "rooms",
		kind: InsightDatasetKind.Rooms,
		numRows: 364,
	};

	before(function () {
		// This section runs once and loads all datasets specified in the datasetsToLoad object
		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]).toString("base64");
			datasetContents.set(key, content);
		}
		courseContent = datasetContents.get("courses") ?? "";
		smallContent = datasetContents.get("smallSample") ?? "";
		emptyContent = datasetContents.get("emptyDirectory") ?? "";
		invalidContent = datasetContents.get("invalidDirectory") ?? "";
		invalidFileContent = datasetContents.get("invalidFile") ?? "";
		roomsContent = datasetContents.get("rooms") ?? "";
		// Just in case there is anything hanging around from a previous run
		fs.removeSync(persistDir);
	});

	beforeEach(function () {
		console.info(`BeforeTest: ${this.currentTest?.title}`);
	});

	afterEach(function () {
		console.info(`AfterTest: ${this.currentTest?.title}`);
	});

	describe("Add/Remove/List tests", function () {
		beforeEach(function () {
			fs.removeSync(persistDir);
			insightFacade = new InsightFacade();
		});

		describe("Add Dataset Tests", function () {
			describe("Successful additions", function () {
				it("should add first sample testData", function () {
					return insightFacade
						.addDataset(myData.id, smallContent, InsightDatasetKind.Courses)
						.then((result: string[]) => {
							expect(result).to.deep.equal([myData.id]);
							return insightFacade.listDatasets();
						})
						.then((result) => {
							expect(result).to.deep.equal([myData]);
						});
				});

				it("should add a rooms dataset successfully", function () {
					return insightFacade
						.addDataset(roomsData.id, roomsContent, InsightDatasetKind.Rooms)
						.then((result: string[]) => {
							expect(result).to.deep.equal([roomsData.id]);
						});
				});

				it("add 3 test datasets", function () {
					return insightFacade
						.addDataset(myData.id, smallContent, myData.kind)
						.then(() => {
							return insightFacade.addDataset(myData2.id, smallContent, myData2.kind);
						})
						.then(() => {
							return insightFacade.addDataset(myData3.id, smallContent, myData3.kind);
						})
						.then((result) => {
							expect(result).to.have.length(3);
							expect(result).to.have.deep.members([myData.id, myData2.id, myData3.id]);
							return insightFacade.listDatasets();
						})
						.then((result) => {
							expect(result).to.have.length(3);
							expect(result).to.have.deep.members([myData, myData2, myData3]);
						});
				});

				describe("Re-adding removed datasets", () => {
					beforeEach(() => {
						return insightFacade
							.addDataset(myData.id, smallContent, InsightDatasetKind.Courses)
							.then(() => {
								return insightFacade.removeDataset(myData.id);
							});
					});

					it("Ensures insightFacade only no datasets", () => {
						return expect(insightFacade.listDatasets()).to.eventually.have.length(0);
					});
					it("Re-adding dataset to empty set", () => {
						return insightFacade
							.addDataset(myData.id, smallContent, InsightDatasetKind.Courses)
							.then((result) => {
								expect(result).to.deep.equal([myData.id]);
								return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData]);
							});
					});

					it("Re-adding data set to non-empty set", () => {
						return insightFacade
							.addDataset(myData2.id, smallContent, InsightDatasetKind.Courses)
							.then(() => {
								return insightFacade.addDataset(myData3.id, smallContent, InsightDatasetKind.Courses);
							})
							.then(() => {
								return insightFacade.listDatasets();
							})
							.then((result) => {
								expect(result).to.have.length(2);
								expect(result).to.have.deep.members([myData2, myData3]);
								return insightFacade.addDataset(myData.id, smallContent, InsightDatasetKind.Courses);
							})
							.then((result) => {
								expect(result).to.have.length(3);
								expect(result).to.have.deep.members([myData.id, myData2.id, myData3.id]);
								return insightFacade.listDatasets();
							})
							.then((result) => {
								expect(result).to.have.length(3);
								expect(result).to.have.deep.members([myData2, myData3, myData]);
							});
					});
				});
			});

			describe("Failed additions", function () {
				it("adding duplicate data set", function () {
					return insightFacade
						.addDataset(myData.id, smallContent, myData.kind)
						.then(() => {
							return insightFacade.addDataset(myData.id, smallContent, myData.kind);
						})
						.then(() => {
							return expect.fail("An InsightError should have been thrown");
						})
						.catch((error) => {
							return expect(error).to.be.instanceof(InsightError);
						});
				});

				it("should fail to add a rooms dataset and courses dataset with the same ID", function () {
					return insightFacade
						.addDataset(roomsData.id, smallContent, InsightDatasetKind.Courses)
						.then(() => {
							return insightFacade.addDataset(roomsData.id, roomsContent, InsightDatasetKind.Rooms);
						})
						.then(() => {
							return expect.fail("An InsightError should have been thrown");
						})
						.catch((error) => {
							return expect(error).to.be.instanceof(InsightError);
						});
				});

				it("should fail because zip file doesn't contain `courses` directory", () => {
					return expect(
						insightFacade.addDataset("courses", invalidContent, InsightDatasetKind.Courses)
					).to.eventually.be.rejectedWith(InsightError);
				});

				it("should fail because zip file doesn't contain `rooms` directory", () => {
					return expect(
						insightFacade.addDataset("rooms", invalidContent, InsightDatasetKind.Rooms)
					).to.eventually.be.rejectedWith(InsightError);
				});

				it("should fail because zip file doesn't contain any valid courses", () => {
					return expect(
						insightFacade.addDataset("courses", emptyContent, InsightDatasetKind.Courses)
					).to.eventually.be.rejectedWith(InsightError);
				});

				it("should fail because zip file doesn't contain any valid rooms", () => {
					return expect(
						insightFacade.addDataset("rooms", emptyContent, InsightDatasetKind.Rooms)
					).to.eventually.be.rejectedWith(InsightError);
				});

				describe("Name contains underscores", function () {
					it("id contains only underscores", function () {
						return expect(insightFacade.addDataset("___", smallContent, myData.kind))
							.to.eventually.be.rejectedWith(InsightError)
							.then(() => {
								return expect(insightFacade.listDatasets()).to.eventually.have.length(0);
							});
					});

					it("id contains only 1 underscore", function () {
						return expect(
							insightFacade.addDataset("_", smallContent, myData.kind)
						).to.eventually.be.rejectedWith(InsightError);
					});

					it("id has leading underscore", function () {
						return expect(
							insightFacade.addDataset("_id1", smallContent, myData.kind)
						).to.eventually.be.rejectedWith(InsightError);
					});

					it("contains trailing underscore in id", function () {
						return expect(
							insightFacade.addDataset("id1_", smallContent, myData.kind)
						).to.eventually.be.rejectedWith(InsightError);
					});

					it("id contains underscore in middle", function () {
						return expect(
							insightFacade.addDataset("id_1", smallContent, myData.kind)
						).to.eventually.be.rejectedWith(InsightError);
					});
				});

				it("id is empty", function () {
					return expect(
						insightFacade.addDataset("", smallContent, myData.kind)
					).to.eventually.be.rejectedWith(InsightError);
				});

				it("id has only one whitespace", function () {
					return expect(
						insightFacade.addDataset(" ", smallContent, myData.kind)
					).to.eventually.be.rejectedWith(InsightError);
				});

				it("id contains only whitespace", function () {
					return expect(
						insightFacade.addDataset("  ", smallContent, myData.kind)
					).to.eventually.be.rejectedWith(InsightError);
				});
			});
		});

		describe("List dataset tests", () => {
			it("Empty data sets", function () {
				return expect(insightFacade.listDatasets()).to.eventually.have.length(0);
			});

			it("Listing one data set", function () {
				return insightFacade.addDataset(myData.id, smallContent, myData.kind).then(() => {
					return expect(insightFacade.listDatasets()).to.eventually.have.deep.members([myData]);
				});
			});

			it("Listing two data sets", function () {
				return insightFacade
					.addDataset(myData.id, smallContent, myData.kind)
					.then(() => {
						return insightFacade.addDataset(myData2.id, smallContent, myData2.kind);
					})
					.then(() => {
						return insightFacade.listDatasets();
					})
					.then((result) => {
						expect(result).to.have.length(2);
						expect(result).to.have.deep.members([myData, myData2]);
					});
			});

			it("Listing three data sets", function () {
				return insightFacade
					.addDataset(myData.id, smallContent, myData.kind)
					.then(() => {
						return insightFacade.addDataset(myData2.id, smallContent, myData2.kind);
					})
					.then(() => {
						return insightFacade.addDataset(myData3.id, smallContent, myData3.kind);
					})
					.then(() => {
						return insightFacade.listDatasets();
					})
					.then((result) => {
						expect(result).to.have.length(3);
						expect(result).to.have.deep.members([myData, myData2, myData3]);
					});
			});
			it("Lists rooms and courses datasets together", function () {
				return insightFacade
					.addDataset(roomsData.id, roomsContent, InsightDatasetKind.Rooms)
					.then((result: string[]) => {
						expect(result).to.deep.equal([roomsData.id]);
						return insightFacade.listDatasets();
					})
					.then((result) => {
						expect(result).to.deep.equal([roomsData]);
					})
					.then(() => {
						return insightFacade.addDataset(myData.id, smallContent, InsightDatasetKind.Courses);
					})
					.then((result: string[]) => {
						expect(result).to.deep.equal([roomsData.id, myData.id]);
						return insightFacade.listDatasets();
					})
					.then((result) => {
						expect(result).to.deep.equal([roomsData, myData]);
					});
			});
		});

		describe("Remove dataset tests", () => {
			describe("Valid removals", () => {
				it("Add and remove 1 dataset", function () {
					return insightFacade
						.addDataset(myData.id, smallContent, myData.kind)
						.then(() => {
							return insightFacade.addDataset(myData3.id, smallContent, myData3.kind);
						})
						.then(() => {
							return insightFacade.removeDataset(myData.id);
						})
						.then((result) => {
							expect(result).to.equal(myData.id);
							return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData3]);
						});
				});

				it("Add and remove rooms dataset", function () {
					return insightFacade
						.addDataset(roomsData.id, roomsContent, InsightDatasetKind.Rooms)
						.then(() => {
							return insightFacade.addDataset(myData3.id, smallContent, myData3.kind);
						})
						.then((result) => {
							expect(result).to.have.deep.members([roomsData.id, myData3.id]);
						})
						.then(() => {
							return insightFacade.removeDataset(roomsData.id);
						})
						.then((result) => {
							expect(result).to.equal(roomsData.id);
							return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData3]);
						});
				});

				describe("Using 2 datasets", function () {
					beforeEach(function () {
						return insightFacade.addDataset(myData.id, smallContent, myData.kind).then(() => {
							return insightFacade.addDataset(myData2.id, smallContent, myData2.kind);
						});
					});

					it("Add 2 datasets and remove 1", function () {
						return expect(insightFacade.removeDataset(myData2.id))
							.to.eventually.deep.equal(myData2.id)
							.then(() => {
								return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData]);
							});
					});

					it("Remove 1 out of order", function () {
						return expect(insightFacade.removeDataset(myData.id))
							.to.eventually.deep.equal(myData.id)
							.then(() => {
								return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData2]);
							});
					});

					it("Add and remove 2 datasets", function () {
						const resultStrings: Promise<[string, string]> = Promise.all([
							insightFacade.removeDataset(myData2.id),
							insightFacade.removeDataset(myData.id),
						]);

						return expect(resultStrings)
							.to.eventually.deep.equal([myData2.id, myData.id])
							.then(() => {
								return expect(insightFacade.listDatasets()).to.eventually.have.length(0);
							});
					});

					it("Remove, re-add, and re-remove dataset", function () {
						return insightFacade
							.removeDataset(myData.id)
							.then(() => {
								return insightFacade.addDataset(myData.id, smallContent, myData.kind);
							})
							.then(() => {
								return expect(insightFacade.removeDataset(myData.id)).to.eventually.deep.equal(
									myData.id
								);
							})
							.then(() => {
								return expect(insightFacade.listDatasets()).to.eventually.deep.equal([myData2]);
							});
					});
				});
			});

			describe("Invalid removals", () => {
				it("Removing from empty set", () => {
					return expect(insightFacade.removeDataset(myData.id)).to.eventually.be.rejectedWith(NotFoundError);
				});

				it("Removing a name with an underscore", () => {
					const invalidID = "invalid_name";
					return expect(insightFacade.removeDataset(invalidID)).to.eventually.be.rejectedWith(InsightError);
				});

				it("Removing a name with just whitespaces", () => {
					const invalidID = "  ";
					return expect(insightFacade.removeDataset(invalidID)).to.eventually.be.rejectedWith(InsightError);
				});

				it("Removing non-existent id from non-empty set", () => {
					const addSampleData: Promise<any[]> = Promise.all([
						insightFacade.addDataset(myData.id, smallContent, myData.kind),
						insightFacade.addDataset(myData2.id, smallContent, myData2.kind),
						insightFacade.addDataset(myData3.id, smallContent, myData3.kind),
					]);
					return addSampleData.then(() => {
						return expect(insightFacade.removeDataset("Not found ID")).to.eventually.be.rejectedWith(
							NotFoundError
						);
					});
				});

				it("Double removing a dataset", () => {
					return insightFacade
						.addDataset(myData.id, smallContent, myData.kind)
						.then(() => {
							return insightFacade.addDataset(myData2.id, smallContent, myData2.kind);
						})
						.then(() => {
							return insightFacade.addDataset(myData3.id, smallContent, myData3.kind);
						})
						.then(() => {
							return insightFacade.removeDataset(myData.id);
						})
						.then(() => {
							return insightFacade.removeDataset(myData.id);
						})
						.then(() => {
							expect.fail("InsightError should have been thrown");
						})
						.catch((error) => {
							expect(error).to.be.instanceof(NotFoundError);
							return insightFacade.listDatasets().then((result) => {
								expect(result).to.have.length(2);
								expect(result).to.have.deep.members([myData2, myData3]);
							});
						});
				});
			});
		});

		describe("Dataset tests", () => {
			// This test kills Dataset mutant
			it("Tries to add a dataset with an invalid JSON file", () => {
				const input: any = {
					WHERE: {},
					OPTIONS: {
						COLUMNS: ["courses_avg"],
						ORDER: "courses_avg",
					},
				};
				const expectedOutput = [
					{
						courses_avg: 76.25,
					},
					{
						courses_avg: 76.25,
					},
				];

				return insightFacade
					.addDataset("courses", invalidFileContent, InsightDatasetKind.Courses)
					.then(() => {
						return insightFacade.listDatasets();
					})
					.then((result) => {
						expect(result[0].numRows).to.equal(2);
						return insightFacade.performQuery(input);
					})
					.then((result) => {
						expect(result).to.have.length(expectedOutput.length);
						expect(result).to.have.deep.members(expectedOutput);
					});
			});

			it("should reject a query that references a dataset that has been deleted", function () {
				const validQuery = {
					WHERE: {
						GT: {
							removeThisDataset_avg: 99,
						},
					},
					OPTIONS: {
						COLUMNS: ["removeThisDataset_dept", "removeThisDataset_avg"],
						ORDER: "removeThisDataset_avg",
					},
				};

				return insightFacade
					.addDataset("removeThisDataset", smallContent, InsightDatasetKind.Courses)
					.then(() => {
						return insightFacade.performQuery(validQuery);
					})
					.then(() => {
						return insightFacade.removeDataset("removeThisDataset");
					})
					.then(() => {
						return expect(insightFacade.performQuery(validQuery)).to.eventually.be.rejectedWith(
							InsightError
						);
					});
			});
		});
	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/queries.
	 * You should not need to modify it; instead, add additional files to the queries directory.
	 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery tests", () => {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);
			fs.removeSync(persistDir);
			insightFacade = new InsightFacade();

			// Load the datasets specified in datasetsToQuery and add them to InsightFacade.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				insightFacade.addDataset("courses", courseContent, InsightDatasetKind.Courses),
				insightFacade.addDataset("rooms", roomsContent, InsightDatasetKind.Rooms),
				insightFacade.addDataset(" invalid * stuff ", smallContent, InsightDatasetKind.Courses),
			];

			return Promise.all(loadDatasetPromises);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
			fs.removeSync(persistDir);
		});

		type Input = any;
		type Output = any[];
		type PQErrorKind = "ResultTooLargeError" | "InsightError";

		testFolder<Input, Output, PQErrorKind>(
			"Dynamic InsightFacade PerformQuery tests",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries",
			{
				assertOnResult: (expected, actual: any[], input: Input) => {
					return Promise.all([expected, actual]).then((result) => {
						const resolvedExpected = result[0],
							resolvedActual = result[1];
						// Initialize ORDER
						let orderDir: string | undefined,
							orderKeys: string[] = [];
						const orderObject: any = input.OPTIONS.ORDER;
						if (!orderObject) {
							orderDir = undefined;
						} else if (typeof orderObject === "string") {
							orderDir = "UP";
							orderKeys.push(orderObject);
						} else if (typeof orderObject === "object") {
							orderDir = orderObject.dir;
							orderKeys = orderObject.keys;
						}

						// Check that result contains correct elements
						expect(resolvedActual).to.be.instanceof(Array);
						expect(resolvedActual.length).to.equal(resolvedExpected.length);
						expect(resolvedActual).to.have.deep.members(resolvedExpected);

						// Checking order of results
						if (orderDir !== undefined) {
							for (let i = 1; i < resolvedActual.length; i++) {
								// Iterating over all results
								compareOrder(resolvedActual[i - 1], resolvedActual[i]);
							}
						}

						// Check that two given objects (first and second) are sorted correctly according to
						// orderDir and orderKeys
						function compareOrder(first: any, second: any): void {
							if (orderDir === "UP") {
								for (const orderKey of orderKeys) {
									if (first[orderKey] > second[orderKey]) {
										expect.fail(`Element '${first[orderKey]}' is greater than '${second[orderKey]}'.
										Order direction is '${orderDir}'.`);
									} else if (first[orderKey] < second[orderKey]) {
										// valid sorting, return
										return;
									}
								}
							} else if (orderDir === "DOWN") {
								for (const orderKey of orderKeys) {
									if (first[orderKey] < second[orderKey]) {
										expect.fail(`Element '${first[orderKey]}' is smaller than '${second[orderKey]}'.
										Order direction is '${orderDir}'.`);
									} else if (first[orderKey] > second[orderKey]) {
										// valid sorting, return
										return;
									}
								}
							} else {
								expect.fail(`Invalid direction '${orderDir}' provided.`);
							}
						}
					});
				},
				errorValidator: (error): error is PQErrorKind =>
					error === "ResultTooLargeError" || error === "InsightError",
				assertOnError(expected, actual) {
					if (expected === "ResultTooLargeError") {
						expect(actual).to.be.instanceof(ResultTooLargeError);
					} else {
						expect(actual).to.be.instanceof(InsightError);
					}
				},
			}
		);
	});
});
