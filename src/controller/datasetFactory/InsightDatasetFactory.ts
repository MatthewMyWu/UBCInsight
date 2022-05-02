import {InsightDatasetImpl} from "../InsightFacade";

export default abstract class InsightDatasetFactory {
	public abstract createDatasetFromZip(zip: string): Promise<InsightDatasetImpl>;
}
