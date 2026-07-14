import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { JiraGatewayPort } from '../domain/report.ports';
import type {
  Issue,
  JiraConfig,
  SearchResponse,
  SprintSnapshot,
  WorklogItem,
  WorklogResponse,
} from '../domain/report.types';

const JIRA_SEARCH_PATH = '/rest/api/3/search/jql';
const JIRA_ISSUE_WORKLOG_PATH = '/rest/api/3/issue';
const JIRA_BOARD_SPRINT_PATH = '/rest/agile/1.0/board';
const SEARCH_FIELDS = ['worklog'];
const SEARCH_EXPAND = 'worklog';
const PAGE_SIZE = 100;
const WORKLOG_PAGE_SIZE = 100;

@Injectable()
export class JiraApiService implements JiraGatewayPort {
  private readonly logger = new Logger(JiraApiService.name);

  async fetchActiveSprint(jira: JiraConfig, boardId: number): Promise<SprintSnapshot | null> {
    const response = await axios.get<{
      values?: Array<{
        name?: string;
        startDate?: string;
        endDate?: string;
      }>;
    }>(
      `${jira.jiraDomain}${JIRA_BOARD_SPRINT_PATH}/${boardId}/sprint`,
      {
        auth: {
          username: jira.jiraEmail,
          password: jira.jiraApiToken,
        },
        headers: {
          Accept: 'application/json',
        },
        params: {
          state: 'active',
          maxResults: 1,
        },
      },
    );

    const sprint = response.data?.values?.[0];
    const sprintName = String(sprint?.name || '').trim();

    if (!sprintName) {
      return null;
    }

    return {
      name: sprintName,
      startDate: sprint?.startDate,
      endDate: sprint?.endDate,
    };
  }

  async fetchIssuesWithWorkLogs(
    jira: JiraConfig,
    jql: string,
    debugEnabled: boolean,
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    let nextPageToken: string | undefined;
    let page = 0;

    do {
      page += 1;
      const payload: Record<string, unknown> = {
        jql,
        maxResults: PAGE_SIZE,
        fields: SEARCH_FIELDS,
        expand: SEARCH_EXPAND,
      };

      if (nextPageToken) {
        payload.nextPageToken = nextPageToken;
      }

      const response = await axios.post<SearchResponse & { nextPageToken?: string }>(
        `${jira.jiraDomain}${JIRA_SEARCH_PATH}`,
        payload,
        {
          auth: {
            username: jira.jiraEmail,
            password: jira.jiraApiToken,
          },
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      if (debugEnabled) {
        this.logJiraResponseDebug(page, response.data);
      }

      issues.push(...(response.data?.issues || []));
      nextPageToken = response.data?.nextPageToken;
    } while (nextPageToken);

    return this.hydrateIssuesWithFullWorkLogs(jira, issues, debugEnabled);
  }

  private async hydrateIssuesWithFullWorkLogs(
    jira: JiraConfig,
    issues: Issue[],
    debugEnabled: boolean,
  ): Promise<Issue[]> {
    const CONCURRENCY = 5;
    const hydratedIssues: Issue[] = [];

    for (let i = 0; i < issues.length; i += CONCURRENCY) {
      const batch = issues.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((issue) => this.hydrateOneIssue(jira, issue, debugEnabled)),
      );
      hydratedIssues.push(...results);
    }

    return hydratedIssues;
  }

  private async hydrateOneIssue(
    jira: JiraConfig,
    issue: Issue,
    debugEnabled: boolean,
  ): Promise<Issue> {
    const issueKey = String(issue?.key || '');
    if (!issueKey) {
      return issue;
    }

    const fullWorkLogs = await this.fetchAllWorkLogsForIssue(jira, issueKey, debugEnabled);
    const existingWorklogField = issue?.fields?.worklog || {};
    const worklog = {
      ...existingWorklogField,
      startAt: 0,
      maxResults: fullWorkLogs.length,
      total: fullWorkLogs.length,
      worklogs: fullWorkLogs,
    };

    return {
      ...issue,
      fields: issue.fields
        ? { ...issue.fields, worklog }
        : { worklog },
    };
  }


  private async fetchAllWorkLogsForIssue(
    jira: JiraConfig,
    issueKey: string,
    debugEnabled: boolean,
  ): Promise<WorklogItem[]> {
    const worklogs: WorklogItem[] = [];
    let startAt = 0;
    let total = Number.POSITIVE_INFINITY;

    while (worklogs.length < total) {
      const response = await axios.get<WorklogResponse>(
        `${jira.jiraDomain}${JIRA_ISSUE_WORKLOG_PATH}/${encodeURIComponent(issueKey)}/worklog`,
        {
          auth: {
            username: jira.jiraEmail,
            password: jira.jiraApiToken,
          },
          headers: {
            Accept: 'application/json',
          },
          params: {
            startAt,
            maxResults: WORKLOG_PAGE_SIZE,
          },
        },
      );

      const pageWorkLogs = response.data?.worklogs || [];
      const pageTotal = Number(response.data?.total || 0);
      const currentStartAt = Number(response.data?.startAt || startAt);

      total = pageTotal;
      worklogs.push(...pageWorkLogs);

      if (debugEnabled) {
        this.logger.log(
          `Issue work logs page issue=${issueKey}, startAt=${currentStartAt}, fetched=${pageWorkLogs.length}, fetchedTotal=${worklogs.length}, total=${total}`,
        );
      }

      if (pageWorkLogs.length === 0) {
        break;
      }

      startAt = currentStartAt + pageWorkLogs.length;
    }

    return worklogs;
  }

  private logJiraResponseDebug(page: number, jiraResponseData: unknown): void {
    const maxLength = 20000;
    let serialized = '';

    try {
      serialized = JSON.stringify(jiraResponseData);
    } catch {
      serialized = '[unserializable-jira-response]';
    }

    const isTruncated = serialized.length > maxLength;
    const output = isTruncated ? `${serialized.slice(0, maxLength)}...[truncated]` : serialized;

    this.logger.log(`Jira raw response page=${page}, length=${serialized.length}, payload=${output}`);
  }
}
