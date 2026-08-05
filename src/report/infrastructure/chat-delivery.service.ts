import axios from 'axios';
import { JWT } from 'google-auth-library';

import { Injectable } from '@nestjs/common';

import type { ChatGatewayPort } from '../domain/report.ports';
import {
    type AggregatedData,
    type AggregatedUser,
    type AggregationAnomalies,
    type ChatDeliveryConfig,
    type ViolationAggregate,
    ChatMode,
} from '../domain/report.types';
import { formatHoursFromSeconds } from '../domain/report.utils';

@Injectable()
export class ChatDeliveryService implements ChatGatewayPort {
  private static readonly MAX_REPORT_ROWS = 50;

  async sendReport(
    chat: ChatDeliveryConfig,
    data: AggregatedData & {
      reportDateTimeLabel: string;
      reportTitle: string;
      sprintSummaryLine?: string;
      anomalies?: AggregationAnomalies;
    },
    jiraCheckUrl: string,
  ): Promise<void> {
    const text = this.buildChatTextReport(data);
    const buttons = [
      ...this.buildRetryButtons(chat),
      {
        text: 'Check in Jira',
        onClick: {
          openLink: {
            url: jiraCheckUrl,
          },
        },
      },
    ];

    await this.postToChat(chat, {
      text,
      cardsV2: [
        {
          cardId: 'jira-check',
          card: {
            sections: [
              {
                widgets: [
                  {
                    buttonList: {
                      buttons,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    });
  }

  private buildChatTextReport(data: {
    users: Record<string, AggregatedUser>;
    reportDate: string;
    reportDateTimeLabel: string;
    reportTitle: string;
    sprintSummaryLine?: string;
    anomalies?: AggregationAnomalies;
  }): string {
    const headerLine = this.buildHeaderLine(data);
    const rows = Object.entries(data.users)
      .map(([name, user]) => {
        const totalSeconds = user.logs[data.reportDate] || 0;
        return { name, totalSeconds };
      })
      .filter((row) => row.totalSeconds > 0)
      .sort((left, right) => right.totalSeconds - left.totalSeconds);

    if (rows.length === 0) {
      const noDataText = 'No work log data at this time';
      const noDataBorder = `+${'-'.repeat(noDataText.length + 2)}+`;
      const noDataLine = `| ${noDataText} |`;

      const blocks = [
        '```',
        headerLine,
        '',
        '1. Valid Work Log Time',
        noDataBorder,
        noDataLine,
        noDataBorder,
      ];

      this.appendViolationSections(blocks, data.anomalies, 2);
      blocks.push('```');
      return blocks.join('\n');
    }

    const grandTotalSeconds = rows.reduce((sumSeconds, row) => sumSeconds + row.totalSeconds, 0);
    const cappedRows = rows.slice(0, ChatDeliveryService.MAX_REPORT_ROWS);
    const nameWidth = Math.max(
      'Author'.length,
      ...cappedRows.map((row, index) => `${index + 1}. ${row.name}`.length),
      'Total'.length,
    );
    const totalWidth = Math.max(
      'Total'.length,
      ...cappedRows.map((row) => formatHoursFromSeconds(row.totalSeconds).length),
      formatHoursFromSeconds(grandTotalSeconds).length,
    );
    const border = `+${'-'.repeat(nameWidth + 2)}+${'-'.repeat(totalWidth + 2)}+`;
    const header = `| ${'Author'.padEnd(nameWidth)} | ${'Total'.padStart(totalWidth)} |`;
    const rowLines = cappedRows.map((row, index) => {
      const hoursText = formatHoursFromSeconds(row.totalSeconds);
      const authorText = `${index + 1}. ${row.name}`;
      return `| ${authorText.padEnd(nameWidth)} | ${hoursText.padStart(totalWidth)} |`;
    });
    const totalHoursText = formatHoursFromSeconds(grandTotalSeconds);
    const totalLine = `| ${'Total'.padEnd(nameWidth)} | ${totalHoursText.padStart(totalWidth)} |`;

    const blocks = [
      '```',
      headerLine,
      '',
      '1. Valid Work Log Time',
      border,
      header,
      border,
      ...rowLines,
      border,
      totalLine,
      border,
    ];

    this.appendViolationSections(blocks, data.anomalies, 2);
    blocks.push('```');
    return blocks.join('\n');
  }

  private appendViolationSections(
    lines: string[],
    anomalies: AggregationAnomalies | undefined,
    startIndex: number,
  ): void {
    if (!anomalies) {
      return;
    }

    let sectionIndex = startIndex;
    const hasBeforeIssueCreated = this.appendViolationTable(
      lines,
      `${sectionIndex}. Logs Before Ticket Creation`,
      anomalies.beforeIssueCreated || { users: {} },
    );
    if (hasBeforeIssueCreated) {
      sectionIndex += 1;
    }

    const hasBeforeSprintStart = this.appendViolationTable(
      lines,
      `${sectionIndex}. Logs Before Sprint Start`,
      anomalies.beforeSprintStart,
    );
    if (hasBeforeSprintStart) {
      sectionIndex += 1;
    }

    this.appendViolationTable(
      lines,
      `${sectionIndex}. Logs On Parent Tickets`,
      anomalies.onParentIssue,
    );
  }

  private appendViolationTable(lines: string[], title: string, violation: ViolationAggregate): boolean {
    const rows = Object.entries(violation.users)
      .map(([name, user]) => ({
        name,
        totalSeconds: user.totalSeconds,
        detailLines: user.issues
          .map((item) => {
            const compactTicketId = this.toCompactTicketId(item.issueKey);
            return `${formatHoursFromSeconds(item.totalSeconds)} (${compactTicketId})`;
          }),
      }))
      .filter((row) => row.totalSeconds > 0 && row.detailLines.length > 0)
      .sort((left, right) => right.totalSeconds - left.totalSeconds);

    if (rows.length === 0) {
      return false;
    }

    const cappedRows = rows.slice(0, ChatDeliveryService.MAX_REPORT_ROWS);
    const authorHeader = 'Author';
    const detailHeader = 'Time & Ticket';
    const authorWidth = Math.max(
      authorHeader.length,
      ...cappedRows.map((row, index) => `${index + 1}. ${row.name}`.length),
    );
    const detailWidth = Math.max(
      detailHeader.length,
      ...cappedRows.flatMap((row) => row.detailLines.map((line) => line.length)),
    );
    const border = `+${'-'.repeat(authorWidth + 2)}+${'-'.repeat(detailWidth + 2)}+`;
    const header = `| ${authorHeader.padEnd(authorWidth)} | ${detailHeader.padEnd(detailWidth)} |`;

    lines.push('');
    lines.push(title);
    lines.push(border);
    lines.push(header);
    lines.push(border);

    for (const [index, row] of cappedRows.entries()) {
      const authorText = `${index + 1}. ${row.name}`;
      const [firstDetailLine, ...restDetailLines] = row.detailLines;
      lines.push(`| ${authorText.padEnd(authorWidth)} | ${String(firstDetailLine || '').padEnd(detailWidth)} |`);

      for (const detailLine of restDetailLines) {
        lines.push(`| ${''.padEnd(authorWidth)} | ${detailLine.padEnd(detailWidth)} |`);
      }
    }

    lines.push(border);
    return true;
  }

  private toCompactTicketId(issueKey: string): string {
    const normalized = String(issueKey || '').trim();
    if (!normalized) {
      return '-';
    }

    const parts = normalized.split('-').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : normalized;
  }

  private buildHeaderLine(data: {
    reportTitle: string;
    reportDateTimeLabel: string;
    sprintSummaryLine?: string;
  }): string {
    const normalizedTitle = this.formatReportTitleForDisplay(data.reportTitle);
    const sprintLine = data.sprintSummaryLine || '';
    const headerLines = [normalizedTitle, sprintLine].filter(Boolean);
    return `${headerLines.join('\n')}\n\nChecked at: ${data.reportDateTimeLabel}`;
  }

  private formatReportTitleForDisplay(reportTitle: string): string {
    const rawTitle = String(reportTitle || '').trim();
    if (!rawTitle.startsWith('-+-') || !rawTitle.endsWith('-+-')) {
      return rawTitle;
    }

    const titleBody = rawTitle.slice(3, -3).trim();
    if (!titleBody) {
      return rawTitle;
    }

    return `-+-[${titleBody}]-+-`;
  }

  private buildRetryButtons(chat: ChatDeliveryConfig): Array<Record<string, unknown>> {
    if (chat.reportUrl) {
      return [
        {
          text: 'Retry',
          onClick: {
            openLink: {
              url: chat.reportUrl,
            },
          },
        },
      ];
    }

    if (chat.mode === ChatMode.APP) {
      return [
        {
          text: 'Retry',
          onClick: {
            action: {
              function: 'retry_report',
            },
          },
        },
      ];
    }

    return [];
  }

  private async postToChat(chat: ChatDeliveryConfig, payload: Record<string, unknown>): Promise<void> {
    if (chat.mode === ChatMode.WEBHOOK) {
      if (!chat.webhook) {
        throw new Error('Missing webhook URL for webhook mode');
      }

      await axios.post(chat.webhook, payload);
      return;
    }

    const accessToken = await this.getGoogleChatAccessToken(chat);
    const url = `https://chat.googleapis.com/v1/${chat.space}/messages`;

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private _cachedToken?: { value: string; expiresAt: number };

  private async getGoogleChatAccessToken(
    chat: Extract<ChatDeliveryConfig, { mode: ChatMode.APP }>,
  ): Promise<string> {
    const now = Date.now();

    if (this._cachedToken && this._cachedToken.expiresAt > now + 60_000) {
      return this._cachedToken.value;
    }

    const client = new JWT({
      email: chat.serviceAccountEmail,
      key: chat.serviceAccountPrivateKey,
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });

    const { access_token: accessToken, expiry_date: expiryDate } = await client.authorize();
    if (!accessToken) {
      throw new Error('Failed to obtain Google Chat access token');
    }

    this._cachedToken = {
      value: accessToken,
      expiresAt: expiryDate ?? now + 3_600_000,
    };

    return accessToken;
  }

}
