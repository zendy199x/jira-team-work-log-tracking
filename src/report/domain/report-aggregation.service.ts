import { Injectable } from '@nestjs/common';
import type {
    AggregatedData,
    AggregatedUser,
    AggregationAnomalies,
    Issue,
    JiraSprintInfo,
    ViolationAggregate,
} from './report.types';
import { normalizeAuthorName } from './report.utils';
import { ReportDate, Timezone } from './value-objects';

@Injectable()
export class ReportAggregationService {
  private static readonly SPRINT_STATE_ACTIVE = 'active';
  private static readonly SPRINT_STATE_FUTURE = 'future';
  private static readonly SPRINT_STATE_CLOSED = 'closed';

  aggregateByReportDate(issues: Issue[], reportDate: ReportDate, timezone: Timezone): AggregatedData {
    const users: Record<string, AggregatedUser> = {};

    for (const issue of issues) {
      const logs = issue?.fields?.worklog?.worklogs || [];
      const issueCreatedTimeMs = this.parseSafeTime(issue?.fields?.created);

      for (const worklog of logs) {
        const startedDate = new Date(String(worklog?.started || ''));
        const startedLocalDate = timezone.formatDate(startedDate);
        const startedTimeMs = startedDate.getTime();

        if (
          issueCreatedTimeMs !== undefined &&
          Number.isFinite(startedTimeMs) &&
          startedTimeMs < issueCreatedTimeMs
        ) {
          continue;
        }

        if (!reportDate.equals(startedLocalDate)) {
          continue;
        }

        const name = normalizeAuthorName(worklog?.author?.displayName || 'Unknown');
        const seconds = worklog?.timeSpentSeconds || 0;

        if (!users[name]) {
          users[name] = { logs: {} };
        }

        users[name].logs[startedLocalDate] = (users[name].logs[startedLocalDate] || 0) + seconds;
      }
    }

    return { users, reportDate: reportDate.value };
  }

  aggregateAnomaliesByReportDate(
    issues: Issue[],
    reportDate: ReportDate,
    timezone: Timezone,
    fallbackSprintStartDate?: string,
    primaryQueryIssueKeys?: Set<string>,
  ): AggregationAnomalies {
    const beforeIssueCreatedAccumulator = new Map<string, Map<string, number>>();
    const beforeSprintStartAccumulator = new Map<string, Map<string, number>>();
    const parentIssueAccumulator = new Map<string, Map<string, number>>();
    const invalidTotalSecondsByUser = new Map<string, number>();
    const fallbackSprintStartTimeMs = this.parseSafeTime(fallbackSprintStartDate);

    for (const issue of issues) {
      const issueKey = String(issue?.key || '').trim();
      if (!issueKey) {
        continue;
      }

      const logs = issue?.fields?.worklog?.worklogs || [];
      const issueCreatedTimeMs = this.parseSafeTime(issue?.fields?.created);
      const isOutsidePrimaryQuery =
        primaryQueryIssueKeys instanceof Set && !primaryQueryIssueKeys.has(issueKey);
      const isNonSubtaskIssue = !this.isSubtaskIssue(issue);
      const issueSprintStartTimeMs = this.resolveIssueSprintStartTimeMs(issue);

      for (const worklog of logs) {
        const startedDate = new Date(String(worklog?.started || ''));
        const startedTimeMs = startedDate.getTime();
        if (!Number.isFinite(startedTimeMs)) {
          continue;
        }

        const startedLocalDate = timezone.formatDate(startedDate);
        if (!reportDate.equals(startedLocalDate)) {
          continue;
        }

        const name = normalizeAuthorName(worklog?.author?.displayName || 'Unknown');
        const seconds = Number(worklog?.timeSpentSeconds || 0);
        if (seconds <= 0) {
          continue;
        }

        const isBeforeIssueCreatedViolation =
          issueCreatedTimeMs !== undefined && startedTimeMs < issueCreatedTimeMs;
        if (isBeforeIssueCreatedViolation) {
          this.addViolation(beforeIssueCreatedAccumulator, name, issueKey, seconds);
          invalidTotalSecondsByUser.set(
            name,
            (invalidTotalSecondsByUser.get(name) || 0) + seconds,
          );
        }

        const sprintStartTimeMs = issueSprintStartTimeMs ?? fallbackSprintStartTimeMs;
        const isBeforeSprintStartViolation =
          sprintStartTimeMs !== undefined && startedTimeMs < sprintStartTimeMs;
        if (isBeforeSprintStartViolation) {
          this.addViolation(beforeSprintStartAccumulator, name, issueKey, seconds);
          invalidTotalSecondsByUser.set(
            name,
            (invalidTotalSecondsByUser.get(name) || 0) + seconds,
          );
        }

        const isParentIssueViolation = isNonSubtaskIssue || isOutsidePrimaryQuery;
        if (isParentIssueViolation) {
          this.addViolation(parentIssueAccumulator, name, issueKey, seconds);
          invalidTotalSecondsByUser.set(
            name,
            (invalidTotalSecondsByUser.get(name) || 0) + seconds,
          );
        }
      }
    }

    return {
      beforeIssueCreated: this.toViolationAggregate(beforeIssueCreatedAccumulator),
      beforeSprintStart: this.toViolationAggregate(beforeSprintStartAccumulator),
      onParentIssue: this.toViolationAggregate(parentIssueAccumulator),
      invalidTotalSecondsByUser: Object.fromEntries(invalidTotalSecondsByUser.entries()),
    };
  }

  private resolveIssueSprintStartTimeMs(issue: Issue): number | undefined {
    const sprints = this.extractIssueSprints(issue);
    if (sprints.length === 0) {
      return undefined;
    }

    const currentSprint = this.pickCurrentSprintForValidation(sprints);
    if (!currentSprint?.startDate) {
      return undefined;
    }

    return this.parseSafeTime(currentSprint.startDate);
  }

  private pickCurrentSprintForValidation(sprints: JiraSprintInfo[]): JiraSprintInfo | undefined {
    const activeSprints = sprints.filter(
      (sprint) => this.normalizeSprintState(sprint.state) === ReportAggregationService.SPRINT_STATE_ACTIVE,
    );
    if (activeSprints.length > 0) {
      return this.pickLatestByStartDate(activeSprints);
    }

    const futureSprints = sprints.filter(
      (sprint) => this.normalizeSprintState(sprint.state) === ReportAggregationService.SPRINT_STATE_FUTURE,
    );
    if (futureSprints.length > 0) {
      return this.pickEarliestByStartDate(futureSprints);
    }

    const closedSprints = sprints.filter(
      (sprint) => this.normalizeSprintState(sprint.state) === ReportAggregationService.SPRINT_STATE_CLOSED,
    );
    if (closedSprints.length > 0) {
      return this.pickLatestByStartDate(closedSprints);
    }

    return this.pickLatestByStartDate(sprints);
  }

  private extractIssueSprints(issue: Issue): JiraSprintInfo[] {
    const fields = issue?.fields;
    if (!fields) {
      return [];
    }

    const candidates: unknown[] = [fields.sprint, fields.closedSprints, ...Object.values(fields)];
    const rawSprints: JiraSprintInfo[] = [];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          if (this.looksLikeSprint(item)) {
            rawSprints.push(item as JiraSprintInfo);
          }
        }
        continue;
      }

      if (this.looksLikeSprint(candidate)) {
        rawSprints.push(candidate as JiraSprintInfo);
      }
    }

    const deduped = new Map<string, JiraSprintInfo>();
    for (const sprint of rawSprints) {
      const key = [
        String(sprint.id ?? ''),
        String(sprint.name ?? ''),
        String(sprint.startDate ?? ''),
        String(sprint.endDate ?? ''),
        String(sprint.state ?? ''),
      ].join('|');

      if (!deduped.has(key)) {
        deduped.set(key, sprint);
      }
    }

    return Array.from(deduped.values());
  }

  private looksLikeSprint(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    const hasSprintSignals =
      'state' in candidate ||
      'startDate' in candidate ||
      'endDate' in candidate ||
      'name' in candidate;

    if (!hasSprintSignals) {
      return false;
    }

    const state = String(candidate.state || '').toLowerCase();
    if (!state) {
      return true;
    }

    return [
      ReportAggregationService.SPRINT_STATE_ACTIVE,
      ReportAggregationService.SPRINT_STATE_FUTURE,
      ReportAggregationService.SPRINT_STATE_CLOSED,
    ].includes(state);
  }

  private normalizeSprintState(state: string | undefined): string {
    return String(state || '').trim().toLowerCase();
  }

  private pickLatestByStartDate(sprints: JiraSprintInfo[]): JiraSprintInfo | undefined {
    return [...sprints].sort((left, right) => {
      const leftTime = this.parseSafeTime(left.startDate) ?? Number.NEGATIVE_INFINITY;
      const rightTime = this.parseSafeTime(right.startDate) ?? Number.NEGATIVE_INFINITY;
      return rightTime - leftTime;
    })[0];
  }

  private pickEarliestByStartDate(sprints: JiraSprintInfo[]): JiraSprintInfo | undefined {
    return [...sprints].sort((left, right) => {
      const leftTime = this.parseSafeTime(left.startDate) ?? Number.POSITIVE_INFINITY;
      const rightTime = this.parseSafeTime(right.startDate) ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    })[0];
  }

  private isSubtaskIssue(issue: Issue): boolean {
    const issueTypeRecord = issue?.fields?.issuetype as
      | { subtask?: unknown; name?: unknown }
      | undefined;
    const hasSubtaskFlag = issueTypeRecord?.subtask;
    if (typeof hasSubtaskFlag === 'boolean') {
      return hasSubtaskFlag;
    }

    const issueTypeName = String(issueTypeRecord?.name || '').trim().toLowerCase();
    if (!issueTypeName) {
      return false;
    }

    return issueTypeName.startsWith('sub');
  }

  private addViolation(
    accumulator: Map<string, Map<string, number>>,
    authorName: string,
    issueKey: string,
    seconds: number,
  ): void {
    const issueTotals = accumulator.get(authorName) || new Map<string, number>();
    issueTotals.set(issueKey, (issueTotals.get(issueKey) || 0) + seconds);
    accumulator.set(authorName, issueTotals);
  }

  private toViolationAggregate(accumulator: Map<string, Map<string, number>>): ViolationAggregate {
    const users: ViolationAggregate['users'] = {};

    for (const [authorName, issueSecondsMap] of accumulator) {
      const issues = Array.from(issueSecondsMap.entries())
        .map(([issueKey, totalSeconds]) => ({ issueKey, totalSeconds }))
        .sort((left, right) => {
          if (right.totalSeconds !== left.totalSeconds) {
            return right.totalSeconds - left.totalSeconds;
          }

          return left.issueKey.localeCompare(right.issueKey);
        });

      const totalSeconds = issues.reduce((sum, issue) => sum + issue.totalSeconds, 0);
      users[authorName] = { totalSeconds, issues };
    }

    return { users };
  }

  private parseSafeTime(rawDate?: string): number | undefined {
    const normalized = String(rawDate || '').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = new Date(normalized).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
