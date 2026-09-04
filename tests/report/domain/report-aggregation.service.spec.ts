import { ReportAggregationService } from '../../../src/report/domain/report-aggregation.service';
import { ReportDate, Timezone } from '../../../src/report/domain/value-objects';

describe('ReportAggregationService', () => {
  const service = new ReportAggregationService();

  it('aggregates only work logs that match report date in timezone', () => {
    const issues = [
      {
        key: 'BKM4-1',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w1',
                author: { displayName: 'Alice (BKM4)' },
                timeSpentSeconds: 3600,
                started: '2026-05-08T18:00:00.000Z',
              },
              {
                id: 'w2',
                author: { displayName: 'Alice (BKM4)' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T20:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('Asia/Ho_Chi_Minh'),
    );

    expect(result.reportDate).toBe('2026-05-09');
    expect(result.users.Alice.logs['2026-05-09']).toBe(3600);
  });

  it('sums multiple work logs for the same normalized author', () => {
    const issues = [
      {
        key: 'BKM4-2',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w3',
                author: { displayName: 'Tyler (OneLine)' },
                timeSpentSeconds: 1200,
                started: '2026-05-09T02:00:00.000Z',
              },
              {
                id: 'w4',
                author: { displayName: 'Tyler' },
                timeSpentSeconds: 2400,
                started: '2026-05-09T06:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(Object.keys(result.users)).toEqual(['Tyler']);
    expect(result.users.Tyler.logs['2026-05-09']).toBe(3600);
  });

  it('excludes logs started before issue creation from summary total', () => {
    const issues = [
      {
        key: 'BKM4-2B',
        fields: {
          created: '2026-05-09T08:30:00.000Z',
          worklog: {
            worklogs: [
              {
                id: 'w4c',
                author: { displayName: 'Tyler' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T08:00:00.000Z',
              },
              {
                id: 'w4d',
                author: { displayName: 'Tyler' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T09:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users.Tyler.logs['2026-05-09']).toBe(3600);
  });

  it('keeps at most two words for long custom author names', () => {
    const issues = [
      {
        key: 'BKM4-2A',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w4a',
                author: { displayName: 'Mark Vu Nguyen' },
                timeSpentSeconds: 7200,
                started: '2026-05-09T06:00:00.000Z',
              },
              {
                id: 'w4b',
                author: { displayName: 'Mark Vu (BKM4)' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(Object.keys(result.users)).toEqual(['Mark Vu']);
    expect(result.users['Mark Vu'].logs['2026-05-09']).toBe(10800);
  });

  it('uses Unknown author fallback and ignores issues without work logs', () => {
    const issues = [
      {
        key: 'BKM4-3',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w5',
                timeSpentSeconds: 900,
                started: '2026-05-09T00:30:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-4',
        fields: {},
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users.Unknown.logs['2026-05-09']).toBe(900);
    expect(Object.keys(result.users)).toHaveLength(1);
  });

  it('handles missing worklog list safely', () => {
    const issues = [
      {
        key: 'BKM4-5',
        fields: {},
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users).toEqual({});
    expect(result.reportDate).toBe('2026-05-09');
  });

  it('uses 0 seconds when timeSpentSeconds is missing', () => {
    const issues = [
      {
        key: 'BKM4-6',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w6',
                author: { displayName: '(NoName)' },
                started: '2026-05-09T00:30:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
    );

    expect(result.users['(NoName)'].logs['2026-05-09']).toBe(0);
  });

  it('throws when work log started date is invalid', () => {
    const issues = [
      {
        key: 'BKM4-7',
        fields: {
          worklog: {
            worklogs: [
              {
                id: 'w7',
                author: { displayName: 'Alice' },
              },
            ],
          },
        },
      },
    ];

    expect(() =>
      service.aggregateByReportDate(issues, ReportDate.from('2026-05-09'), Timezone.from('UTC')),
    ).toThrow();
  });

  it('aggregates before-sprint-start violations by author and issue', () => {
    const issues = [
      {
        key: 'BKM4-1111',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          sprint: {
            id: 11,
            name: 'Sprint 11',
            state: 'future',
            startDate: '2026-05-09T12:00:00.000Z',
          },
          worklog: {
            worklogs: [
              {
                id: 'w1',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 7200,
                started: '2026-05-09T08:00:00.000Z',
              },
              {
                id: 'w2',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T09:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      '2026-05-09T12:00:00.000Z',
    );

    expect(result.beforeSprintStart.users.Zendy.totalSeconds).toBe(10800);
    expect(result.beforeSprintStart.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-1111', totalSeconds: 10800 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(10800);
  });

  it('aggregates violations where worklog started before issue creation', () => {
    const issues = [
      {
        key: 'BKM4-1100',
        fields: {
          created: '2026-05-09T09:00:00.000Z',
          issuetype: { name: 'Sub-task', subtask: true },
          sprint: {
            id: 10,
            name: 'Sprint 10',
            state: 'active',
            startDate: '2026-05-09T07:00:00.000Z',
          },
          worklog: {
            worklogs: [
              {
                id: 'wBeforeCreate',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T08:00:00.000Z',
              },
              {
                id: 'wAfterCreate',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 1200,
                started: '2026-05-09T10:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.beforeIssueCreated?.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-1100', totalSeconds: 1800 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(1800);
  });

  it('flags non-subtask issue logs as parent-ticket violations except bug with parent', () => {
    const issues = [
      {
        key: 'BKM4-2000',
        fields: {
          issuetype: { name: 'Story', subtask: false },
          subtasks: [{ key: 'BKM4-2001' }],
          worklog: {
            worklogs: [
              {
                id: 'w3',
                author: { displayName: 'Alice' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-3001',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          parent: { key: 'BKM4-3000' },
        },
      },
      {
        key: 'BKM4-3000',
        fields: {
          issuetype: { name: 'Epic', subtask: false },
          worklog: {
            worklogs: [
              {
                id: 'w4',
                author: { displayName: 'Bob' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T11:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-4000',
        fields: {
          issuetype: { name: 'Task', subtask: false },
          worklog: {
            worklogs: [
              {
                id: 'w5',
                author: { displayName: 'Charlie' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T11:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-5000',
        fields: {
          issuetype: { name: 'Bug', subtask: false },
          parent: { key: 'BKM4-4999' },
          worklog: {
            worklogs: [
              {
                id: 'w6',
                author: { displayName: 'Delta' },
                timeSpentSeconds: 1200,
                started: '2026-05-09T11:30:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.onParentIssue.users.Alice.issues).toEqual([
      { issueKey: 'BKM4-2000', totalSeconds: 1800 },
    ]);
    expect(result.onParentIssue.users.Bob.issues).toEqual([
      { issueKey: 'BKM4-3000', totalSeconds: 3600 },
    ]);
    expect(result.onParentIssue.users.Charlie.issues).toEqual([
      { issueKey: 'BKM4-4000', totalSeconds: 3600 },
    ]);
    expect(result.onParentIssue.users.Delta).toBeUndefined();
    expect(result.invalidTotalSecondsByUser?.Alice).toBe(1800);
    expect(result.invalidTotalSecondsByUser?.Bob).toBe(3600);
    expect(result.invalidTotalSecondsByUser?.Charlie).toBe(3600);
    expect(result.invalidTotalSecondsByUser?.Delta).toBeUndefined();
  });

  it('does not flag bug issue with parent even when outside primary query', () => {
    const issues = [
      {
        key: 'BKM4-BUG-PARENT',
        fields: {
          issuetype: { name: 'Bug', subtask: false },
          parent: { key: 'BKM4-ROOT' },
          worklog: {
            worklogs: [
              {
                id: 'wBugParent',
                author: { displayName: 'Alice' },
                timeSpentSeconds: 2400,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
      new Set(['BKM4-IN-SUMMARY']),
    );

    expect(result.onParentIssue.users.Alice).toBeUndefined();
    expect(result.invalidTotalSecondsByUser?.Alice).toBeUndefined();
  });

  it('flags issue logs outside primary query as parent-ticket violations', () => {
    const issues = [
      {
        key: 'BKM4-OUTSIDE',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          worklog: {
            worklogs: [
              {
                id: 'wOutside',
                author: { displayName: 'Alice' },
                timeSpentSeconds: 2400,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
      new Set(['BKM4-IN-SUMMARY']),
    );

    expect(result.onParentIssue.users.Alice.issues).toEqual([
      { issueKey: 'BKM4-OUTSIDE', totalSeconds: 2400 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Alice).toBe(2400);
  });

  it('flags sub-task logs when ticket is not assigned to any sprint', () => {
    const issues = [
      {
        key: 'BKM4-9100',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          worklog: {
            worklogs: [
              {
                id: 'wNoSprint',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.onChildTicketWithoutSprint?.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-9100', totalSeconds: 1800 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(1800);
  });

  it('flags Epic and Story logs when team policy requires Subtask logging', () => {
    const issues = [
      {
        key: 'BKM4-8100',
        fields: {
          issuetype: { name: 'Epic', subtask: false },
          worklog: {
            worklogs: [
              {
                id: 'wEpic',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 1800,
                started: '2026-05-09T08:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-8101',
        fields: {
          issuetype: { name: 'Story', subtask: false },
          worklog: {
            worklogs: [
              {
                id: 'wStory',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 5400,
                started: '2026-05-09T09:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        key: 'BKM4-8102',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          parent: { key: 'BKM4-8101' },
          worklog: {
            worklogs: [
              {
                id: 'wSub',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T10:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.onParentIssue.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-8101', totalSeconds: 5400 },
      { issueKey: 'BKM4-8100', totalSeconds: 1800 },
    ]);
    expect(result.onChildTicketWithoutSprint?.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-8102', totalSeconds: 3600 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(10800);
  });

  it('does not flag ticket that belongs to previous closed sprint after sprint rollover', () => {
    const issues = [
      {
        key: 'BKM4-5000',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          sprint: {
            id: 10,
            name: 'Sprint 10',
            state: 'closed',
            startDate: '2026-05-01T00:00:00.000Z',
            endDate: '2026-05-09T12:00:00.000Z',
          },
          worklog: {
            worklogs: [
              {
                id: 'w6',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T13:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      '2026-05-09T17:00:00.000Z',
    );

    expect(result.beforeSprintStart.users.Zendy).toBeUndefined();
    expect(result.invalidTotalSecondsByUser?.Zendy).toBeUndefined();
  });

  it('flags ticket that belongs to future sprint when worklog is before that sprint start', () => {
    const issues = [
      {
        key: 'BKM4-6000',
        fields: {
          issuetype: { name: 'Sub-task', subtask: true },
          sprint: {
            id: 11,
            name: 'Sprint 11',
            state: 'future',
            startDate: '2026-05-10T00:00:00.000Z',
            endDate: '2026-05-20T23:59:59.000Z',
          },
          worklog: {
            worklogs: [
              {
                id: 'w7',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 7200,
                started: '2026-05-09T17:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.beforeSprintStart.users.Zendy.issues).toEqual([
      { issueKey: 'BKM4-6000', totalSeconds: 7200 },
    ]);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(7200);
  });

  it('assigns only highest-priority violation when a worklog matches multiple rules', () => {
    const issues = [
      {
        key: 'BKM4-7000',
        fields: {
          subtasks: [{ key: 'BKM4-7001' }],
          sprint: {
            id: 12,
            name: 'Sprint 12',
            state: 'future',
            startDate: '2026-05-12T00:00:00.000Z',
            endDate: '2026-05-22T23:59:59.000Z',
          },
          worklog: {
            worklogs: [
              {
                id: 'w8',
                author: { displayName: 'Zendy' },
                timeSpentSeconds: 3600,
                started: '2026-05-09T10:00:00.000Z',
              },
            ],
          },
        },
      },
    ];

    const result = service.aggregateAnomaliesByReportDate(
      issues,
      ReportDate.from('2026-05-09'),
      Timezone.from('UTC'),
      undefined,
    );

    expect(result.beforeSprintStart.users.Zendy).toBeUndefined();
    expect(result.onParentIssue.users.Zendy.totalSeconds).toBe(3600);
    expect(result.invalidTotalSecondsByUser?.Zendy).toBe(3600);
  });
});
