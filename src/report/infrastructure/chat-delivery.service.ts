import axios from 'axios';
import { JWT } from 'google-auth-library';

import { Injectable } from '@nestjs/common';

import type { ChatGatewayPort } from '../domain/report.ports';
import {
    type AggregatedData,
    type AggregatedUser,
    type ChatDeliveryConfig,
    ChatMode,
} from '../domain/report.types';
import { formatHoursFromSeconds } from '../domain/report.utils';

@Injectable()
export class ChatDeliveryService implements ChatGatewayPort {
  private static readonly MAX_REPORT_ROWS = 50;

  async sendReport(
    chat: ChatDeliveryConfig,
    data: AggregatedData & { reportDateTimeLabel: string; reportTitle: string; sprintSummaryLine?: string },
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
  }): string {
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

      return [
        '```',
        data.reportTitle,
        ...(data.sprintSummaryLine ? [data.sprintSummaryLine] : []),
        ...(data.sprintSummaryLine ? [''] : []),
        `Date: ${data.reportDateTimeLabel}`,
        noDataBorder,
        noDataLine,
        noDataBorder,
        '```',
      ].join('\n');
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

    return [
      '```',
      data.reportTitle,
      ...(data.sprintSummaryLine ? [data.sprintSummaryLine] : []),
      ...(data.sprintSummaryLine ? [''] : []),
      `Date: ${data.reportDateTimeLabel}`,
      border,
      header,
      border,
      ...rowLines,
      border,
      totalLine,
      border,
      '```',
    ].join('\n');
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
