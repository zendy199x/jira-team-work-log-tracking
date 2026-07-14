import type {
    AggregatedData,
    ChatDeliveryConfig,
    Issue,
    JiraConfig,
    ReportRuntimeConfig,
    SprintSnapshot,
} from './report.types';

export const REPORT_CONFIG_PORT = Symbol('REPORT_CONFIG_PORT');
export const JIRA_GATEWAY_PORT = Symbol('JIRA_GATEWAY_PORT');
export const CHAT_GATEWAY_PORT = Symbol('CHAT_GATEWAY_PORT');

export interface ReportConfigPort {
  getRuntimeConfig(): ReportRuntimeConfig;
  canTriggerWithToken(token: string): boolean;
  isRetryAction(invokedFunction: string): boolean;
}

export interface JiraGatewayPort {
  fetchIssuesWithWorkLogs(jira: JiraConfig, jql: string, debugEnabled: boolean): Promise<Issue[]>;
  fetchActiveSprint(jira: JiraConfig, boardId: number): Promise<SprintSnapshot | null>;
}

export interface ChatGatewayPort {
  sendReport(
    chat: ChatDeliveryConfig,
    data: AggregatedData & { reportDateTimeLabel: string; reportTitle: string; sprintSummaryLine?: string },
    jiraCheckUrl: string,
  ): Promise<void>;
}
