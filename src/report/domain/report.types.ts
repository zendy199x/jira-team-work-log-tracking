
export interface IssueFields {
  summary?: string;
  worklog?: WorklogResponse;
}

export interface WorklogAuthor {
  displayName?: string;
  emailAddress?: string;
}

export interface WorklogItem {
  id?: string;
  timeSpentSeconds?: number;
  started?: string;
  created?: string;
  updated?: string;
  author?: WorklogAuthor;
}

export interface WorklogResponse {
  total?: number;
  maxResults?: number;
  startAt?: number;
  worklogs?: WorklogItem[];
}

export interface Issue {
  key: string;
  fields?: IssueFields;
  worklog?: WorklogResponse;
}

export interface SearchResponse {
  issues?: Issue[];
}

export interface JiraConfig {
  jiraDomain: string;
  jiraEmail: string;
  jiraApiToken: string;
}

export interface SprintSnapshot {
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportRuntimeConfig {
  timezone: string;
  reportDate: string;
  reportDateTimeLabel: string;
  reportTitle: string;
  jiraBoardId?: number;
  jiraQuery: string;
  aggregationDebug: AggregationDebugConfig;
  jiraCheckUrl: string;
  jira: JiraConfig;
  chat: ChatDeliveryConfig;
}

export interface AggregationDebugConfig {
  enabled: boolean;
  authorFilters: string[];
}

export enum ChatMode {
  WEBHOOK = 'webhook',
  APP = 'app',
}

export type ChatDeliveryConfig =
  | {
      mode: ChatMode.WEBHOOK;
      webhook: string;
      reportUrl?: string;
    }
  | {
      mode: ChatMode.APP;
      space: string;
      serviceAccountEmail: string;
      serviceAccountPrivateKey: string;
      reportUrl?: string;
    };

export interface AggregatedUser {
  logs: Record<string, number>;
}

export interface AggregatedData {
  users: Record<string, AggregatedUser>;
  reportDate: string;
}

export interface GoogleChatEvent {
  type?: string;
  action?: {
    actionMethodName?: string;
    parameters?: Array<{ key?: string; value?: string }>;
  };
}
