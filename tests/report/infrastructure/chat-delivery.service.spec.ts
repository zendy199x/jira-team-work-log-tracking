import axios from 'axios';
import { JWT } from 'google-auth-library';

import { ChatMode } from '../../../src/report/domain/report.types';
import {
    formatHoursFromSeconds,
} from '../../../src/report/domain/report.utils';
import {
    ChatDeliveryService,
} from '../../../src/report/infrastructure/chat-delivery.service';

const authorizeMock = jest.fn().mockResolvedValue({ access_token: 'mock-token' });

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({
    authorize: authorizeMock,
  })),
}));

describe('ChatDeliveryService', () => {
  const postMock = jest.mocked(axios.post);
  const jwtMock = jest.mocked(JWT);

  beforeEach(() => {
    jest.clearAllMocks();
    authorizeMock.mockResolvedValue({ access_token: 'mock-token' });
  });

  it('sends webhook report and actions in one payload', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com', reportUrl: 'https://app/retry' },
      {
        users: { Alice: { logs: { '2026-05-09': 3600 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(postMock).toHaveBeenCalledTimes(1);
    const payload = postMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.cardsV2).toBeDefined();
    expect(payload.text).toBeDefined();
    expect(JSON.stringify(payload)).toContain('-+-[BKM4 WORK LOG REPORT]-+-');
    expect(JSON.stringify(payload)).toContain('Checked at: May 9');
    expect(JSON.stringify(payload)).toContain('```');
  });

  it('renders no-data report text', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com' },
      {
        users: {},
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    const payload = postMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(payload)).toContain('No work log data at this time');
  });

  it('renders sprint summary line when provided', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com' },
      {
        users: { Alice: { logs: { '2026-05-09': 3600 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        sprintSummaryLine: 'Sprint 10 | Jul 12th, 2026 to Jul 21st, 2026',
      },
      'https://jira/check',
    );

    const payload = postMock.mock.calls[0]?.[1] as Record<string, unknown>;
    const text = String(payload.text || '');
    expect(text).toContain('Sprint 10 | Jul 12th, 2026 to Jul 21st, 2026');
    expect(text).toContain('-+-[BKM4 WORK LOG REPORT]-+-Sprint 10 | Jul 12th, 2026 to Jul 21st, 2026Checked at: May 9');
  });

  it('sends app-mode message with bearer token', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();

    await service.sendReport(
      {
        mode: ChatMode.APP,
        space: 'spaces/AAA',
        serviceAccountEmail: 'svc@example.com',
        serviceAccountPrivateKey: 'key',
      },
      {
        users: { Bob: { logs: { '2026-05-09': 1200 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    expect(jwtMock).toHaveBeenCalled();
    expect(JSON.stringify(postMock.mock.calls)).toContain('Bearer mock-token');
  });

  it('uses openLink retry button in app mode when reportUrl is provided', async () => {
    postMock.mockImplementation(async () => ({}));
    const service = new ChatDeliveryService();
    const appChatConfig = {
      mode: ChatMode.APP,
      space: 'spaces/AAA',
      serviceAccountEmail: 'svc@example.com',
      serviceAccountPrivateKey: 'key',
      reportUrl: 'http://localhost:3000/reports/retry?token=abc',
    };

    await service.sendReport(
      appChatConfig as unknown as Parameters<ChatDeliveryService['sendReport']>[0],
      {
        users: { Bob: { logs: { '2026-05-09': 1200 } } },
        reportDate: '2026-05-09',
        reportDateTimeLabel: 'May 9',
        reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
      },
      'https://jira/check',
    );

    const cardPayload = postMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(cardPayload)).toContain('"openLink"');
    expect(JSON.stringify(cardPayload)).toContain('http://localhost:3000/reports/retry?token=abc');
    expect(JSON.stringify(cardPayload)).not.toContain('"retry_report"');
  });

  it('throws if webhook mode has no webhook', async () => {
    const service = new ChatDeliveryService();

    await expect(
      service.sendReport(
        { mode: ChatMode.WEBHOOK, webhook: '' },
        {
          users: {},
          reportDate: '2026-05-09',
          reportDateTimeLabel: 'May 9',
          reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        },
        'https://jira/check',
      ),
    ).rejects.toThrow('Missing webhook URL for webhook mode');
  });

  it('throws when sending combined report payload fails', async () => {
    postMock.mockRejectedValueOnce(new Error('send-failed'));
    const service = new ChatDeliveryService();

    await expect(
      service.sendReport(
        { mode: ChatMode.WEBHOOK, webhook: 'https://chat.example.com', reportUrl: 'https://app/retry' },
        {
          users: { Alice: { logs: { '2026-05-09': 600 } } },
          reportDate: '2026-05-09',
          reportDateTimeLabel: 'May 9',
          reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        },
        'https://jira/check',
      ),
    ).rejects.toThrow('send-failed');
  });

  it('throws when app-mode cannot obtain access token', async () => {
    authorizeMock.mockResolvedValueOnce({});

    const service = new ChatDeliveryService();

    await expect(
      service.sendReport(
        {
          mode: ChatMode.APP,
          space: 'spaces/AAA',
          serviceAccountEmail: 'svc@example.com',
          serviceAccountPrivateKey: 'key',
        },
        {
          users: { Bob: { logs: { '2026-05-09': 1200 } } },
          reportDate: '2026-05-09',
          reportDateTimeLabel: 'May 9',
          reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
        },
        'https://jira/check',
      ),
    ).rejects.toThrow('Failed to obtain Google Chat access token');
  });

  it('caps report rows and formats totals via helper', () => {
    const service = new ChatDeliveryService();
    const users: Record<string, { logs: Record<string, number> }> = {};
    for (let index = 1; index <= 55; index += 1) {
      users[`User ${index}`] = { logs: { '2026-05-09': 3600 } };
    }

    const output = service['buildChatTextReport']({
      users,
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
    });

    expect(output).toContain('Total');
    expect(output).toContain('50. User 50');
    expect(output).not.toContain('51. User 51');
    expect(formatHoursFromSeconds(1800)).toBe('0.5h');
    expect(formatHoursFromSeconds(4800)).toBe('1.33h');
  });

  it('filters out users with zero seconds in helper output', () => {
    const service = new ChatDeliveryService();
    const output = service['buildChatTextReport']({
      users: {
        Alice: { logs: { '2026-05-09': 0 } },
        Bob: { logs: { '2026-05-09': 3600 } },
      },
      reportDate: '2026-05-09',
      reportDateTimeLabel: 'May 9',
      reportTitle: '-+-BKM4 WORK LOG REPORT-+-',
    });

    expect(output).toContain('Bob');
    expect(output).not.toContain('Alice');
  });
});
