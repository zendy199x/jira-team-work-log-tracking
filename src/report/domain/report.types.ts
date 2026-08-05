
export interface IssueFields {
  summary?: string;
  created?: string;
  parent?: {
    key?: string;
  };
  subtasks?: Array<{
    key?: string;
  }>;
  issuetype?: {
    name?: string;
    subtask?: boolean;
  };
  sprint?: JiraSprintInfo | JiraSprintInfo[];
  closedSprints?: JiraSprintInfo[];
  [key: string]: unknown;
  worklog?: WorklogResponse;
}

export interface JiraSprintInfo {
  id?: number | string;
  name?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
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
  jiraAnomalyQuery: string;
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

export interface ViolationIssueAggregate {
  issueKey: string;
  totalSeconds: number;
}

export interface ViolationUserAggregate {
  totalSeconds: number;
  issues: ViolationIssueAggregate[];
}

export interface ViolationAggregate {
  users: Record<string, ViolationUserAggregate>;
}

export interface AggregationAnomalies {
  beforeIssueCreated?: ViolationAggregate;
  beforeSprintStart: ViolationAggregate;
  onParentIssue: ViolationAggregate;
  invalidTotalSecondsByUser?: Record<string, number>;
}

export interface GoogleChatEvent {
  type?: string;
  action?: {
    actionMethodName?: string;
    parameters?: Array<{ key?: string; value?: string }>;
  };
}
