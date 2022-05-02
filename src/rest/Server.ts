import express, {Application, Request, Response} from "express";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	NotFoundError,
} from "../controller/IInsightFacade";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;

	constructor(port: number) {
		console.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		this.express.use(express.static("./frontend"));
		this.putNewDataset = this.putNewDataset.bind(this);
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public start(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.info("Server::start() - start");
			if (this.server !== undefined) {
				console.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express
					.listen(this.port, () => {
						console.info(`Server::start() - server listening on port: ${this.port}`);
						resolve();
					})
					.on("error", (err: Error) => {
						// catches errors in server start
						console.error(`Server::start() - server ERROR: ${err.message}`);
						reject(err);
					});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public stop(): Promise<void> {
		console.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				console.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					console.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware() {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({type: "application/*", limit: "10mb"}));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes() {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", this.echo);
		this.express.get("/datasets", this.getDatasets);
		this.express.put("/dataset/:id/:kind", this.putNewDataset);
		this.express.delete("/dataset/:id", this.deleteDataset);
		this.express.post("/query", this.postQuery);
	}

	public echo(req: Request, res: Response) {
		try {
			const response = `it is ${req.params.msg}`;
			res.status(200).json({result: response});
		} catch(e) {
			res.status(400).json({error: e});
		}
	}

	public getDatasets(req: Request, res: Response) {
		const insightFacade: IInsightFacade = new InsightFacade();
		insightFacade
			.listDatasets()
			.then((result: InsightDataset[]) => {
				res.status(200).json({result: result});
			})
			.catch((err) => {
				res.status(400).json({error: err.message});
			});
	}

	public putNewDataset(req: Request, res: Response) {
		try {
			const id: string = req.params["id"];
			const kind: InsightDatasetKind = Server.getKind(req.params["kind"]);
			const dataset: string = (req.body as Buffer).toString("base64");
			const insightFacade: IInsightFacade = new InsightFacade();
			insightFacade
				.addDataset(id, dataset, kind)
				.then((result: string[]) => {
					res.status(200).json({result: result});
				})
				.catch((err) => {
					res.status(400).json({error: err.message});
				});
		} catch (err: any) {
			res.status(400).json({error: err.message});
		}
	}

	public deleteDataset(req: Request, res: Response) {
		const id: string = req.params["id"];
		const insightFacade: IInsightFacade = new InsightFacade();
		insightFacade
			.removeDataset(id)
			.then((result: string) => {
				res.status(200).json({result: result});
			})
			.catch((err) => {
				if (err instanceof NotFoundError) {
					res.status(404).json({error: err.message});
				} else {
					res.status(400).json({error: err.message});
				}
			});
	}

	public postQuery(req: Request, res: Response) {
		const insightFacade: IInsightFacade = new InsightFacade();
		insightFacade
			.performQuery(req.body)
			.then((result: unknown) => {
				res.status(200).json({result: result});
			})
			.catch((err) => {
				res.status(400).json({error: err.message});
			});
	}

	private static getKind(kindString: string): InsightDatasetKind {
		const kinds: string[] = Object.values(InsightDatasetKind);
		if (!kinds.includes(kindString)) {
			throw new Error("Kind is not a valid InsightDatasetKind.");
		}
		return kindString as InsightDatasetKind;
	}
}
