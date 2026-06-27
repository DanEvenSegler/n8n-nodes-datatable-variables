import {
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	INodeExecutionData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { DbManager } from './db';

const db = new DbManager();

export class DatatableVariablesTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Datatable Variables Trigger',
		name: 'datatableVariablesTrigger',
		icon: {
			light: 'file:../../icons/datatable-trigger.svg',
			dark: 'file:../../icons/datatable-trigger.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["tableName"]}}',
		usableAsTool: true,
		description: 'Triggers when a variable in a local datatable changes',
		defaults: {
			name: 'Datatable Variables Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		polling: true,
		properties: [
			{
				displayName: 'Table Name',
				name: 'tableName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTables',
				},
				default: '',
				required: true,
				description: 'The name of the table to watch for changes',
			},
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				options: [
					{
						name: 'All Changes in the Table',
						value: 'all',
					},
					{
						name: 'Specific Variable',
						value: 'specific',
					},
					{
						name: 'Multiple Variables',
						value: 'multiple',
					},
				],
				default: 'all',
				description: 'Choose when to trigger the workflow',
			},
			{
				displayName: 'Variable Key',
				name: 'variableKey',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						triggerOn: ['specific'],
					},
				},
				description: 'The specific variable key to watch',
			},
			{
				displayName: 'Variable Keys',
				name: 'variableKeys',
				type: 'string',
				typeOptions: {
					multipleValues: true,
				},
				default: [],
				required: true,
				displayOptions: {
					show: {
						triggerOn: ['multiple'],
					},
				},
				description: 'The specific variable keys to watch',
			},
		],
	};

	methods = {
		loadOptions: {
			async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const tableNames = await db.getTables();
				return tableNames.map(name => ({
					name,
					value: name,
				}));
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const tableName = this.getNodeParameter('tableName') as string;
		const triggerOn = this.getNodeParameter('triggerOn') as 'all' | 'specific' | 'multiple';

		const staticData = this.getWorkflowStaticData('node');
		const lastProcessedId = staticData.lastProcessedChangeId as number | undefined;

		const latestChangeId = await db.getLatestChangeId();

		if (lastProcessedId === undefined) {
			// Initialize storage to skip previous changes on workflow activation
			staticData.lastProcessedChangeId = latestChangeId;
			return null;
		}

		if (latestChangeId <= lastProcessedId) {
			return null;
		}

		// Fetch changes since last processed
		const changes = await db.getChanges(lastProcessedId);
		if (changes.length === 0) {
			staticData.lastProcessedChangeId = latestChangeId;
			return null;
		}

		const filteredChanges: any[] = [];

		let targetKeys: string[] = [];
		if (triggerOn === 'specific') {
			targetKeys = [this.getNodeParameter('variableKey') as string];
		} else if (triggerOn === 'multiple') {
			targetKeys = this.getNodeParameter('variableKeys') as string[];
		}

		for (const change of changes) {
			// 1. Must be the right table (or bulk tables update)
			if (change.tableName !== tableName && change.tableName !== '*') {
				continue;
			}

			// 2. Filter by key if specific or multiple selected
			if (triggerOn !== 'all') {
				if (change.key !== '*' && !targetKeys.includes(change.key)) {
					continue;
				}
			}

			filteredChanges.push(change);
		}

		// Update storage with the latest processed ID
		staticData.lastProcessedChangeId = latestChangeId;

		if (filteredChanges.length === 0) {
			return null;
		}

		// Return changes grouped as execution items
		return [this.helpers.returnJsonArray(filteredChanges)];
	}
}
