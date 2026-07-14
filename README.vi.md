# Jira Team Work Log Tracking API (Tiếng Việt)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE) [![Node 22.x](https://img.shields.io/badge/Node-22.x-339933?logo=node.js&logoColor=white)](package.json) [![pnpm 11](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)](package.json) [![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)

NestJS API mã nguồn mở để theo dõi work log Jira theo team, tự động tạo báo cáo và gửi Google Chat.

Bản tiếng Anh (mặc định): [README.md](README.md)

Nếu dự án này giúp ích cho team của bạn, hãy cho repository một sao.

## Vì Sao Dự Án Này Tồn Tại

- Theo dõi Jira work log theo team và ngày báo cáo, có xử lý múi giờ.
- Trigger báo cáo thủ công hoặc theo lịch qua GitHub Actions cron.
- Gửi report card lên Google Chat theo chế độ webhook hoặc app mode.
- Kiến trúc mô-đun, dễ mở rộng.

## Tính Năng

- Lấy Jira issue + worklog có hỗ trợ phân trang.
- Tổng hợp theo hướng domain, sử dụng value objects.
- Gửi Google Chat:
  - Webhook mode.
  - App mode (service account).
- Các endpoint trigger:
  - Chạy thủ công.
  - Retry flow.
  - Chat event callback.
- Trang health/help có liên kết theo môi trường.

## Công Nghệ

- NestJS 11
- TypeScript
- Axios
- Jest (coverage nghiêm ngặt)
- Vercel Serverless Functions + GitHub Actions

## Cấu Trúc Dự Án

```text
api/
----| _handler.ts
----| cron.ts
----| [...path].ts
----| reports/
----| ----| run.ts
----| ----| retry.ts
----| ----| chat/
----| ----| ----| events.ts
src/
----| app.module.ts
----| health.controller.ts
----| report/
----| ----| application/
----| ----| domain/
----| ----| infrastructure/
----| ----| report.controller.ts
----| ----| report.service.ts
----| ----| report.scheduler.ts
tests/
```

## Yêu Cầu

- Node.js: 22.x
- pnpm: 11.x

## Bắt Đầu Nhanh

1. Cài dependencies:

```bash
corepack enable
pnpm install
```

1. Tạo file env local:

```bash
cp .env.example .env
```

1. Chạy server ở chế độ development:

```bash
pnpm run start:dev
```

Base URL local:

```text
http://localhost:3000
```

## Biến Môi Trường

Lấy `.env.example` làm nguồn tham chiếu chính.

### Bắt Buộc

- TEAM_NAME
- JIRA_DOMAIN
- JIRA_EMAIL
- JIRA_API_TOKEN
- CRON_SECRET (bắt buộc để trigger an toàn trên production)

### Cấu Hình Chat

GOOGLE_CHAT_MODE có thể là webhook hoặc app.

Nếu GOOGLE_CHAT_MODE=webhook:

- WEBHOOK (bắt buộc)

Nếu GOOGLE_CHAT_MODE=app:

- GOOGLE_CHAT_SPACE (bắt buộc)
- GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL (bắt buộc)
- GOOGLE_CHAT_SERVICE_ACCOUNT_PRIVATE_KEY (bắt buộc)

### Tùy Chọn

- APP_BASE_URL
- API_BASE_PATH
- REPORT_TIMEZONE
- TZ
- REPORT_DATE
- JIRA_JQL_OVERRIDE
- REPORT_DEBUG
- REPORT_DEBUG_AUTHORS

### Câu JQL Mặc Định

Mặc định hệ thống dùng JQL template sau:

```text
project = {TEAM_NAME} AND type IN (Sub-Bug, "Sub-Env and SCM", Sub-Imp, "Sub-Legacy Bug", "Sub PML", "Sub Project Kaizen", Sub-Test, "Sub Skill Up", Sub-task, Sub-ritual, "Sub Refinement", Sub-overhead, "Sub Test Execution", "Sub Automation") AND worklogDate >= startOfDay(-2d)
```

`{TEAM_NAME}` được thay từ `TEAM_NAME` lúc runtime.

Để override query này trực tiếp qua env, set:

```text
JIRA_JQL_OVERRIDE=project = {TEAM_NAME} AND statusCategory != Done
```

`JIRA_JQL_OVERRIDE` được ưu tiên hơn query mặc định.

## API Endpoints

### Route Nội Bộ Của Nest

| Method | Route                | Mục đích                           |
| ------ | -------------------- | ---------------------------------- |
| GET    | /                    | Trang landing                      |
| GET    | /health              | Health check                       |
| GET    | /help                | Hướng dẫn setup                    |
| GET    | /readme              | Alias cũ cho /help                 |
| POST   | /reports/run         | Trigger report thủ công            |
| GET    | /reports/retry       | Retry report flow                  |
| POST   | /reports/chat/events | Nhận callback event từ Google Chat |

### Public Route Trên Vercel

Serverless handler map `/api/*` về Nest routes.

| Method | Public Route             | Internal Route       | Mục đích                |
| ------ | ------------------------ | -------------------- | ----------------------- |
| GET    | /api                     | /                    | Trang landing           |
| GET    | /api/health              | /health              | Health check            |
| GET    | /api/help                | /help                | Hướng dẫn setup         |
| POST   | /api/reports/run         | /reports/run         | Trigger report thủ công |
| GET    | /api/reports/retry       | /reports/retry       | Retry report flow       |
| POST   | /api/reports/chat/events | /reports/chat/events | Google Chat callback    |

Dedicated cron endpoint:

| Method | Route     | Mục đích               |
| ------ | --------- | ---------------------- |
| GET    | /api/cron | Trigger cron theo lịch |

## Lệnh Test Local

Health:

```bash
curl http://localhost:3000/health
```

Manual run:

```bash
curl -X POST "http://localhost:3000/reports/run?token=YOUR_CRON_SECRET"
```

Mở trang xác nhận retry:

```bash
curl "http://localhost:3000/reports/retry?token=YOUR_CRON_SECRET"
```

Trigger retry trực tiếp:

```bash
curl -X POST "http://localhost:3000/reports/retry?token=YOUR_CRON_SECRET"
```

## Scripts

### build

Compile ứng dụng NestJS vào thư mục dist.

```bash
pnpm run build
```

### start

Chạy bản build trong dist.

```bash
pnpm run start
```

### start:dev

Chạy ứng dụng ở chế độ development có watch file.

```bash
pnpm run start:dev
```

### test

Chạy unit tests in-band.

```bash
pnpm run test
```

### test:coverage

Chạy tests kèm coverage và ngưỡng coverage.

```bash
pnpm run test:coverage
```

### test:ci

Chạy tests ở chế độ CI.

```bash
pnpm run test:ci
```

### ci:verify

Chạy full quality gate: coverage, build và phrase checks.

```bash
pnpm run ci:verify
```

### cron:run

Chạy cron runner từ bản build.

```bash
pnpm run cron:run
```

### cron:dev

Cài dependency với frozen lockfile, build rồi chạy cron flow.

```bash
pnpm run cron:dev
```

## Deploy Lên Vercel

1. Link project:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

1. Cấu hình biến môi trường Production trên Vercel.

1. Deploy:

```bash
pnpm dlx vercel --prod --yes
```

Lịch cron:

- Vercel Cron path: `/api/cron`
- Vercel schedule: `30 9 * * 1-5` (UTC), tương đương 16:30 thứ Hai đến thứ Sáu theo giờ Việt Nam

- GitHub Actions workflow: `.github/workflows/report-cron.yml`
- GitHub Actions schedule: `30 9 * * 1-5` (UTC), tương đương 16:30 thứ Hai đến thứ Sáu theo giờ Việt Nam

GitHub Actions secrets cần có:

- `REPORT_CRON_URL` (ví dụ: `https://your-domain.com/api/cron`)
- `CRON_SECRET` (phải trùng với `CRON_SECRET` trên Vercel Production)

Nhánh main đang bật auto deployment.

## CI Và Chất Lượng

Lệnh khuyến nghị trước khi merge:

```bash
pnpm run test:coverage
pnpm run build
pnpm tsc -p tsconfig.spec.json --noEmit
```

## Khắc Phục Sự Cố

### 401 Invalid or missing cron secret

- Đảm bảo CRON_SECRET đã được set đúng.
- Truyền token qua header/query đúng như endpoint yêu cầu.

### 500 Function Invocation Failed on Vercel

- Kiểm tra Vercel function logs trước.
- Xác nhận env production đã đầy đủ.
- Đảm bảo branch/deployment hiện tại đúng theo ý định.

### Timezone mismatch

- Set REPORT_TIMEZONE rõ ràng.
- Dùng REPORT_DATE để kiểm tra theo ngày cố định.

## Bảo Mật

- Không commit file .env và secrets.
- Rotate credentials nếu bị lộ.
- Bảo mật service-account keys và API tokens.

Xem [SECURITY.md](SECURITY.md) để biết hướng dẫn disclosure.

## Cộng Đồng

- Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md)
- Quy tắc ứng xử: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Chính sách bảo mật: [SECURITY.md](SECURITY.md)
- PR template: [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)

Rất hoan nghênh issues và pull requests.

## Giấy Phép

MIT, xem [LICENSE](LICENSE).
