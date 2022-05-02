import Server from "../../src/rest/Server";
import InsightFacade from "../../src/controller/InsightFacade";
import * as fs from "fs-extra";
import chai, {expect, use} from "chai";
import chaiHttp from "chai-http";
import {InsightDataset, InsightDatasetKind} from "../../src/controller/IInsightFacade";

function checkIfJsonWithStatusCode(res: any, statusCode: number, log: boolean = true) {
	if (log) {
		console.log(`${res.req.method} ${res.status} ${res.req.path}`);
		console.log(res.body);
	}
	expect(res).to.be.json;
	expect(res.status).to.be.equal(statusCode);
}

describe("Facade D3", function () {
	let facade: InsightFacade;
	let server: Server;
	const persistDir = "./data";
	let SERVER_URL: string = "localhost:4321/";

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		courses: "./test/resources/archives/courses.zip",
		smallCourses: "./test/resources/archives/smallCourses.zip",
		emptyDirectory: "./test/resources/archives/emptyDirectory.zip",
		invalidDirectory: "./test/resources/archives/invalidDirectory.zip",
		invalidFile: "./test/resources/archives/invalidFile.zip",
		rooms: "./test/resources/archives/rooms.zip",
		smallRooms: "./test/resources/archives/smallRooms.zip",
	};

	use(chaiHttp);

	const courseContent: Buffer = fs.readFileSync(datasetsToLoad.courses);
	const smallCoursesContent: Buffer = fs.readFileSync(datasetsToLoad.smallCourses);
	const emptyContent: Buffer = fs.readFileSync(datasetsToLoad.emptyDirectory);
	const invalidContent: Buffer = fs.readFileSync(datasetsToLoad.invalidDirectory);
	const invalidFileContent: Buffer = fs.readFileSync(datasetsToLoad.invalidFile);
	const roomsContent: Buffer = fs.readFileSync(datasetsToLoad.rooms);
	const smallRoomsContent: Buffer = fs.readFileSync(datasetsToLoad.smallRooms);

	const smallCoursesDataset: InsightDataset = {
		id: "courses",
		kind: InsightDatasetKind.Courses,
		numRows: 3,
	};

	const smallDataset2: InsightDataset = {
		id: "courses2",
		kind: InsightDatasetKind.Courses,
		numRows: 3,
	};

	const roomsDataset: InsightDataset = {
		id: "rooms",
		kind: InsightDatasetKind.Rooms,
		numRows: 364,
	};

	const smallRoomsDataset: InsightDataset = {
		id: "rooms",
		kind: InsightDatasetKind.Rooms,
		numRows: 31,
	};

	before(function () {
		fs.removeSync(persistDir);
		server = new Server(4321);
		// TODO: start server here once and handle errors properly
		try {
			server.start();
		} catch (error) {
			expect.fail("Server did not start successfully");
		}
		console.log();
	});

	after(function () {
		// TODO: stop server here once!
		console.log();
		server.stop();
	});

	beforeEach(function () {
		// might want to add some process logging here to keep track of what"s going on
	});

	afterEach(function () {
		// might want to add some process logging here to keep track of what"s going on
	});

	describe("Dataset REST methods tests", function () {
		beforeEach(function () {
			fs.removeSync(persistDir);
		});

		it("PUT test for valid courses dataset", function () {
			let ENDPOINT_URL = "dataset/courses/courses";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallCoursesContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["courses"]});
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("HTTP request failed");
				});
		});

		it("PUT test for valid rooms dataset", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("HTTP request failed");
				});
		});

		it("PUT test for invalid kind", function () {
			let ENDPOINT_URL = "dataset/courses/kind";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(smallCoursesContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT test for invalid ID with underscorse", function () {
			let ENDPOINT_URL = "dataset/invalid_id/courses";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(invalidContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT test for invalid ID only whitespace", function () {
			let ENDPOINT_URL = "dataset/   /courses";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(invalidContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT test for invalid directory", function () {
			let ENDPOINT_URL = "dataset/courses/courses";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(invalidContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT test for invalid file", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(invalidFileContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT test for empty file", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			try {
				return chai
					.request(SERVER_URL)
					.put(ENDPOINT_URL)
					.send(emptyContent)
					.set("Content-Type", "application/x-zip-compressed")
					.then((res) => {
						checkIfJsonWithStatusCode(res, 400);
						expect(res.body).to.ownPropertyDescriptor("error");
					});
			} catch (err) {
				// and some more logging here!
				console.log(err);
				expect.fail("test failed");
			}
		});

		it("PUT DELETE test for valid dataset ID with a space", function () {
			let ENDPOINT_URL = "dataset/test id/courses";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallCoursesContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["test id"]});
				})
				.then(() => {
					ENDPOINT_URL = "dataset/test id";
					return chai.request(SERVER_URL).delete(ENDPOINT_URL);
				})
				.then((res) => {
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: "test id"});
				});
		});

		it("DELETE test for invalid dataset ID with an underscore", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.then(() => {
					ENDPOINT_URL = "dataset/invalid_id";
					return chai.request(SERVER_URL).delete(ENDPOINT_URL);
				})
				.then((res) => {
					checkIfJsonWithStatusCode(res, 400);
					expect(res.body).to.ownPropertyDescriptor("error");
				});
		});

		it("DELETE test for no existing dataset ID", function () {
			let ENDPOINT_URL = "dataset/missing";
			return chai
				.request(SERVER_URL)
				.delete(ENDPOINT_URL)
				.then((res) => {
					checkIfJsonWithStatusCode(res, 404);
					expect(res.body).to.ownPropertyDescriptor("error");
				});
		});

		it("DELETE test for nonexistent dataset ID", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.then(() => {
					ENDPOINT_URL = "dataset/courses";
					return chai.request(SERVER_URL).delete(ENDPOINT_URL);
				})
				.then((res) => {
					checkIfJsonWithStatusCode(res, 404);
					expect(res.body).to.ownPropertyDescriptor("error");
				});
		});

		it("GET PUT test for valid courses dataset", function () {
			let ENDPOINT_URL = "dataset/courses/courses";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallCoursesContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["courses"]});
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallCoursesDataset]);
					expect(res.status).to.be.equal(200);
				})
				.then(() => {
					ENDPOINT_URL = "dataset/courses2/courses";
					return chai
						.request(SERVER_URL)
						.put(ENDPOINT_URL)
						.send(smallCoursesContent)
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members(["courses", "courses2"]);
					expect(res.status).to.be.equal(200);
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallCoursesDataset, smallDataset2]);
					expect(res.status).to.be.equal(200);
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("The test failed due to the above error.");
				});
		});

		it("GET PUT test for valid courses and rooms dataset", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.then(() => {
					ENDPOINT_URL = "dataset/courses/courses";
					return chai
						.request(SERVER_URL)
						.put(ENDPOINT_URL)
						.send(smallCoursesContent)
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members(["rooms", "courses"]);
					expect(res.status).to.be.equal(200);
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallCoursesDataset, smallRoomsDataset]);
					expect(res.status).to.be.equal(200);
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("The test failed due to the above error.");
				});
		});

		it("GET PUT DELETE test for one valid rooms dataset", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallRoomsDataset]);
				})
				.then(() => {
					ENDPOINT_URL = "dataset/rooms";
					return chai.request(SERVER_URL).delete(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: "rooms"});
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: []});
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("The test failed due to the above error.");
				});
		});

		it("GET PUT DELETE test for valid courses and rooms dataset", function () {
			let ENDPOINT_URL = "dataset/rooms/rooms";
			return chai
				.request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(smallRoomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: ["rooms"]});
				})
				.then(() => {
					ENDPOINT_URL = "dataset/courses/courses";
					return chai
						.request(SERVER_URL)
						.put(ENDPOINT_URL)
						.send(smallCoursesContent)
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members(["rooms", "courses"]);
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallCoursesDataset, smallRoomsDataset]);
				})
				.then(() => {
					ENDPOINT_URL = "dataset/courses";
					return chai.request(SERVER_URL).delete(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.deep.equal({result: "courses"});
				})
				.then(() => {
					ENDPOINT_URL = "datasets";
					return chai.request(SERVER_URL).get(ENDPOINT_URL);
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members([smallRoomsDataset]);
				})
				.catch(function (err) {
					// some logging here please!
					console.log(err);
					expect.fail("The test failed due to the above error.");
				});
		});
	});

	describe("Query REST endpoint tests", function () {
		before(() => {
			fs.removeSync(persistDir);
			return chai
				.request(SERVER_URL)
				.put("dataset/rooms/rooms")
				.send(roomsContent)
				.set("Content-Type", "application/x-zip-compressed")
				.then(() => {
					return chai
						.request(SERVER_URL)
						.put("dataset/courses/courses")
						.send(courseContent)
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					// some logging here please!
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.deep.members(["rooms", "courses"]);
				})
				.catch((err) => {
					console.log("Error in setup!");
					console.log(err);
				});
		});

		it("POST should give error on invalid query", () => {
			const query = {
				title: "Very invalid query",
				input: {
					OPTIONS: {},
				},
				errorExpected: true,
				with: "InsightError",
			};
			return chai
				.request(SERVER_URL)
				.post("query")
				.send(query)
				.set("Content-Type", "application/json")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 400);
					expect(res.body).to.ownPropertyDescriptor("error");
				});
		});

		it("POST should give error on query with too many results", () => {
			const query = {
				WHERE: {
					GT: {
						courses_avg: 0,
					},
				},
				OPTIONS: {
					COLUMNS: ["courses_dept", "courses_avg"],
					ORDER: "courses_avg",
				},
			};
			return chai
				.request(SERVER_URL)
				.post("query")
				.send(query)
				.set("Content-Type", "application/json")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 400);
					expect(res.body).to.ownPropertyDescriptor("error");
				});
		});

		it("POST should succeed on a valid query", () => {
			const query = {
				WHERE: {
					GT: {
						courses_avg: 97,
					},
				},
				OPTIONS: {
					COLUMNS: ["courses_dept", "courses_avg"],
					ORDER: "courses_avg",
				},
			};
			return chai
				.request(SERVER_URL)
				.post("query")
				.send(query)
				.set("Content-Type", "application/json")
				.then((res) => {
					checkIfJsonWithStatusCode(res, 200);
					expect(res.body).to.have.ownPropertyDescriptor("result");
					expect(res.body.result).to.have.length(49);
				});
		});
	});
});
