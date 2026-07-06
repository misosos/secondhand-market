# secondhand-market

중고거래 플랫폼 MVP. pnpm workspace + Turborepo 모노레포.

## 구조

```
apps/
  web/            # Next.js (App Router)
  api/            # NestJS API
packages/
  types/          # 프론트/백 공유 타입 (DTO, enum)
  config/         # 공유 tsconfig / eslint 설정
```

## 실행 방법

### 0. 준비물

- Node >= 20, pnpm 10.x, Docker Desktop

### 1. 최초 설치 (한 번만)

```bash
pnpm install

# 환경변수 파일 준비 (.env는 루트/도커용, apps/api/.env는 Prisma CLI·API 서버가 직접 읽음)
cp .env.example .env
cp .env apps/api/.env

# Postgres(5432) + Redis(6379) + MinIO(9000, S3 호환 로컬 스토리지) 기동
docker compose up -d
```

MinIO는 최초 1회 버킷을 직접 만들어줘야 합니다 (컨테이너를 새로 만들 때만 필요, 볼륨이 살아있으면 재실행 불필요):

```bash
docker exec secondhand-minio mc alias set myminio http://localhost:9000 secondhand secondhand123
docker exec secondhand-minio mc mb -p myminio/secondhand-market-dev
docker exec secondhand-minio mc anonymous set download myminio/secondhand-market-dev
```

DB 마이그레이션 적용 + 초기 시드:

```bash
pnpm --filter api prisma:migrate   # Prisma 마이그레이션 적용
pnpm --filter api seed             # 전체 채팅방(isGlobal) row 시드
```

### 2. 개발 서버 실행

API와 웹은 각자 다른 터미널에서 띄웁니다 (하나가 다른 하나를 자동으로 켜주지 않습니다):

```bash
# 터미널 1
pnpm --filter api dev     # http://localhost:4000  (헬스체크: /api/health)

# 터미널 2
pnpm --filter web dev     # http://localhost:3000
```

브라우저에서 http://localhost:3000 접속 → 회원가입/로그인 → 상품 등록(이미지 업로드까지 포함, MinIO가 켜져 있어야 함) → 채팅/신고까지 전부 이 상태에서 확인 가능합니다.

### 3. 두 번째 실행부터 (재부팅 후 등)

```bash
docker compose up -d     # 컨테이너가 멈춰 있었다면 재기동 (볼륨은 유지되어 데이터는 남아있음)
pnpm --filter api dev
pnpm --filter web dev
```

`docker compose down`으로 컨테이너를 내려도 볼륨은 남으므로 마이그레이션/버킷 생성을 다시 할 필요는 없습니다. `docker compose down -v`로 볼륨까지 지운 경우에만 위 1번 설치 과정을 다시 밟으면 됩니다.

### 4. 테스트 실행

```bash
pnpm --filter api test        # unit 테스트 (mocked Prisma/Redis, DB 불필요)
pnpm --filter api test:e2e    # e2e 테스트 (실제 Postgres/Redis 필요 — docker compose up 상태여야 함)
```

e2e는 dev DB를 건드리지 않도록 별도 테스트 DB를 씁니다. 최초 1회만 준비:

```bash
docker exec secondhand-postgres psql -U secondhand -d postgres -c "CREATE DATABASE secondhand_market_test"
cd apps/api && DATABASE_URL="postgresql://secondhand:secondhand@localhost:5432/secondhand_market_test?schema=public" npx prisma migrate deploy
```

### 자주 쓰는 명령 모음

| 목적 | 명령 |
|---|---|
| 전체 의존성 설치 | `pnpm install` |
| Postgres/Redis/MinIO 기동 | `docker compose up -d` |
| Postgres/Redis/MinIO 중지 | `docker compose down` |
| API 개발 서버 | `pnpm --filter api dev` |
| 웹 개발 서버 | `pnpm --filter web dev` |
| API 빌드 | `pnpm --filter api build` |
| Prisma 마이그레이션 적용 | `pnpm --filter api prisma:migrate` |
| Prisma Studio (DB GUI) | `pnpm --filter api exec prisma studio` |
| unit 테스트 | `pnpm --filter api test` |
| e2e 테스트 | `pnpm --filter api test:e2e` |

### infra / common (3단계)

- `infra/prisma`: `PrismaService` (전역, connect/disconnect 라이프사이클). soft-delete 기본 필터는 Prisma 확장(magic) 대신 각 모듈 서비스에서 명시적으로 적용할 예정 (admin/audit 조회 시 예외 처리가 쉬움).
- `infra/redis`: `RedisService`(ioredis 단일 커넥션 공유) + `RedisThrottlerStorage`(Lua 스크립트로 INCR+블록 처리를 원자적으로 수행하는 `@nestjs/throttler` 커스텀 스토리지, 수평 확장 인스턴스 간 race condition 방지) + `RedisIoAdapter`(Socket.io 수평 확장용, `main.ts`에서 연결).
- `infra/storage`: `StorageService` — S3 presigned PUT URL 발급 (이미지 content-type 화이트리스트 적용).
- `common/guards`: `JwtAuthGuard`(HTTP), `WsJwtGuard`(Socket.io) — 둘 다 auth 모듈이 `JwtModule`을 전역 등록하는 4단계부터 실제로 라우트에 적용됨.
- `common/decorators`: `@CurrentUser()`, `@Public()`, `@SanitizeHtml()`(XSS 방어용 class-transformer 트랜스폼, bio/채팅 내용에 4·7단계에서 적용 예정).
- `common/filters`: `AllExceptionsFilter` — 모든 예외를 `{statusCode, message, error, path, timestamp}` 형태로 통일.
- `config/env.validation.ts`: class-validator 기반 환경변수 검증, 부트스트랩 시 실패하면 즉시 종료.
- 전역 `ThrottlerGuard` + Redis 스토리지로 전 API에 rate limit 적용 (기본 `THROTTLE_LIMIT`/`THROTTLE_TTL_MS`, 로그인/회원가입은 `@Throttle()`로 더 엄격하게 override).

### auth / user (4단계)

- `auth/strategies`: Passport `JwtStrategy`(access token 검증) + `LocalStrategy`(로그인 시 username/password 검증). `common/guards/jwt-auth.guard.ts`가 `AuthGuard('jwt')`를 감싸 전역 `APP_GUARD`로 등록됨 — `@Public()` 없는 모든 라우트는 기본적으로 인증 필요.
- 회원가입: bcrypt 해시(salt rounds 10), username unique 제약 위반 시 409. 로그인: bcrypt 비교, `DORMANT` 계정은 403으로 로그인 차단.
- JWT Access(15m)/Refresh(7d) 발급, refresh token은 SHA-256 해시로 Redis에 저장 후 매 refresh마다 회전(rotation). 회전된(구) 토큰 재사용 시 탈취로 간주해 세션 전체를 즉시 폐기 — refresh token엔 매번 고유 `jti`를 부여해 같은 초(second)에 발급된 토큰이 우연히 동일해지는 것을 방지(실제로 이 버그를 잡아서 수정함).
- 비밀번호 변경 시 기존 refresh 세션을 강제로 무효화(다른 기기 재로그인 필요).
- `/users/me`(GET·PATCH), `/users/me/password`(PATCH)는 본인 전용, `/users/:id`는 공개 조회. bio는 `@SanitizeHtml()`로 XSS 방어(태그 전체 제거) — curl로 `<script>` 삽입 테스트 완료.
- 응답에서 `password` 필드는 절대 노출되지 않음(서비스 계층에서 명시적으로 `PublicUser`만 매핑).

### product (5단계)

- 목록(`GET /products`)은 공개, **커서(keyset) 페이지네이션** + 검색(name/description, 대소문자 무시) + 정렬(`createdAt`|`price`, `asc`|`desc`) 지원. Prisma 내장 `cursor` 옵션은 정렬 필드가 unique 제약이어야 해서 못 쓰고, 커서에 `{정렬값, id}`를 인코딩해 `(field < v) OR (field = v AND id < id_cursor)` 형태의 WHERE로 직접 구현(`product.pagination.ts`).
- 상세(`GET /products/:id`)도 공개. `BLOCKED` 상태거나 `deletedAt`이 있으면 목록·상세 모두에서 제외.
- 등록/수정/삭제는 인증 필요, 수정·삭제는 소유자 본인만(타 유저 시도 시 403). 삭제는 soft delete.
- 상품 등록 시 `DORMANT` 여부를 **DB에서 실시간 재조회**해서 막음 — access token은 최대 15분간 유효하므로, 로그인 이후 휴면 처리된 계정이 토큰 만료 전에 등록을 시도하는 경우까지 차단하려면 토큰 payload가 아니라 현재 상태를 다시 조회해야 함 (curl로 이 시나리오 직접 재현해서 검증함).
- 이미지 업로드는 `POST /products/uploads/presigned`로 S3 presigned PUT URL 발급 (인증 필요, `image/jpeg|png|webp|gif`만 허용).
- 가격은 정수(원 단위)만 허용, DTO에서 float 자체를 거부.

### report (6단계) — 트랜잭션 기반 자동 제재

- `POST /reports`만 존재(별도 admin 모듈은 확정 아키텍처에 없어 범위 밖). 사유 없으면 400(DTO 검증), 동일 대상 중복 신고는 스키마의 `@@unique([reporterId, targetUserId])` / `@@unique([reporterId, targetProductId])`에 의해 409.
- 신고 저장 → `reportCount` 증가 → 임계치(`REPORT_BLOCK_THRESHOLD`, 기본 5) 판정을 **하나의 Prisma `$transaction`**으로 처리. SELECT 후 UPDATE가 아니라 **`update`의 반환값(증가 후 카운트)으로 직접 판정**해서, 두 신고가 동시에 들어와도 마지막 증가분이 유실되지 않음(트랜잭션 내 row lock으로 직렬화).
- **판단이 필요했던 부분**: 스키마에 "검토 대기/플래그" 같은 중간 상태가 따로 없어서(User는 ACTIVE/DORMANT, Product는 ACTIVE/BLOCKED/SOLD뿐), 임계치 도달 시 1단계(자동·가역적)로 Product는 `BLOCKED`, User는 `DORMANT`로 전환하도록 구현했습니다. 이미 있는 `Report.status=PENDING`이 곧 관리자 검토 큐 역할을 하고, 이후 사람이 검토해서 되돌리거나 확정하는 것이 2단계라는 해석입니다. DORMANT 재사용 결정은 확인이 필요하면 말씀해주세요 — 다르게 원하시면 바로 바꿀 수 있습니다.
- 어뷰징(부계정 담합) 방어는 최소 수준으로: 가입한 지 얼마 안 된 계정은 신고 자체가 불가(`MIN_REPORTER_ACCOUNT_AGE_MS`, 기본 10분), 자기 자신/자기 상품 신고 차단, 신고 API에 별도 rate limit(`REPORT_THROTTLE`). IP/기기 기반 담합 탐지는 스키마에 관련 필드가 없어 범위 밖이라는 점을 코드 주석에 명시.
- curl로 직접 검증: 사유 누락 400 / 자기 자신·자기 상품 신고 400 / 신규 계정 신고 403 / 중복 신고 409 / 서로 다른 5개 계정이 같은 대상 신고 → 5번째에 유저 DORMANT·상품 BLOCKED 전환 → DORMANT 전환 즉시 로그인 차단(4단계 로직과 연동 확인) / BLOCKED 전환 즉시 목록·상세에서 제외(5단계 로직과 연동 확인).

### chat (7단계) — WebSocket, controller 대신 gateway

- 확정 구조대로 REST controller 없이 `gateway/service/module/dto`만 구현. 모든 상호작용은 Socket.io 이벤트: `chat:join`(1:1 방 열기), `chat:send`(메시지 전송), `chat:history`(커서 페이지네이션 히스토리).
- 연결 시 JWT 검증은 `handleConnection`에서 즉시 수행(토큰 없거나 유효하지 않으면 바로 disconnect) + `WsJwtGuard`로 메시지마다 재검증(15분짜리 access token이 긴 연결 도중 만료될 수 있어서 이중으로 확인).
- `getOrCreateDmRoom`: 스키마에 (userA,userB) 쌍에 대한 unique 제약이 없어서, 동시에 들어온 최초 대화 시도가 방을 두 개 만들 수 있는 race가 있었음 — `pg_advisory_xact_lock`으로 정렬된 유저쌍을 잠가서 해결. 실제로 두 소켓이 동시에 `chat:join`을 보내는 시나리오로 재현해서 방이 정확히 1개만 생기는 것 확인.
- 메시지는 DB 저장 후 해당 Socket.io room에만 브로드캐스트. Redis `INCR`+`PEXPIRE` 고정 윈도우로 초당 3건 제한(전용 rate limit, HTTP용 `ThrottlerGuard`와는 별도 — WS 컨텍스트에 안 걸림).
- 전체 채팅(`isGlobal`)은 스펙대로 구현하지 않음(1:1만).
- 휴면 계정은 채팅 참여(join/send/history) 전체 차단, 매번 DB에서 실시간 재조회.
- **테스트 중 실제로 잡은 버그 2건**: (1) `main.ts`의 전역 `ValidationPipe`가 HTTP 어댑터에만 붙어서 WS 메시지에는 전혀 적용되지 않고 있었음 — `chat:send`에 `<script>` 태그를 보내봤더니 그대로 저장/브로드캐스트되는 걸 발견하고, 게이트웨이에 `@UsePipes(new ValidationPipe(...))`를 직접 달아서 고침. (2) Nest의 기본 WS 예외 처리가 `WsException`만 알아듣고 `ValidationPipe`가 던지는 `BadRequestException`은 그냥 "Internal server error"로 뭉개버려서, 실제 검증 메시지가 클라이언트에 전혀 안 보였음 — `HttpException`을 `WsException`으로 변환해주는 `WsExceptionsFilter`를 추가해서 해결. 둘 다 socket.io-client로 직접 붙어서 재현·검증 완료.

### apps/web (8단계) — Next.js App Router

- 확정 구조대로 `app/`(라우트) · `components/`(순수 UI) · `features/`(도메인 로직/훅) · `lib/`(api.ts, socket.ts) 분리.
- **인증**: 백엔드가 토큰을 JSON 응답으로만 발급하고 Set-Cookie를 쓰지 않아서(확정된 계약), 토큰은 localStorage에 저장. `lib/api.ts`가 fetch 인터셉터 역할 — 401을 받으면 `/auth/refresh`로 자동 재시도하되, 동시에 여러 요청이 401을 받아도 refresh는 한 번만 실행(single-flight)하도록 처리 — refresh token 회전 로직상 두 번째 refresh 시도는 서버가 거부하기 때문. 보호된 페이지(`mypage`, `products/new`, `products/[id]/edit`)는 서버 세션이 없어 미들웨어로 못 막고, `useRequireAuth()`로 클라이언트에서 리다이렉트.
- **채팅**: `features/chat/useChat.ts`가 소켓 연결·`chat:join`·`chat:history`·`chat:send`·`chat:new` 구독을 전부 캡슐화. Nest 게이트웨이가 에러를 ack가 아니라 별도 `exception` 이벤트로 보낸다는 걸(7단계 테스트로 이미 확인) 알고 있었기 때문에, ack에 타임아웃을 걸고 `exception` 이벤트를 별도로 구독하는 식으로 설계.
- **이미지 업로드**: presigned URL을 받아 브라우저에서 직접 S3(호환) 스토리지로 PUT. 이걸 실제로 검증하려고 로컬 MinIO를 docker-compose에 추가함(스토리지 자체는 이미 3단계에서 S3 호환으로 설계해뒀던 것 활용).
- 스타일은 별도 프레임워크 없이 CSS Modules(Next.js 기본 내장)만 사용 — 확정 스택에 CSS 프레임워크 언급이 없어서 추가 의존성 없는 쪽을 선택.
- **브라우저에서 실제로 검증**: Playwright로 헤드리스 Chromium을 띄워 회원가입 → 로그인 상태 확인 → 이미지 업로드 포함 상품 등록 → 홈 목록 노출 확인 → 다른 계정으로 로그인해 판매자와 1:1 채팅 열고 메시지 송수신 확인 → 상품 신고 → 마이페이지 소개글 저장 → 로그아웃까지 전체 플로우를 3번 반복 실행해 통과 확인. 신고 시도 중 "가입 10분 미만 계정은 신고 불가"(6단계에서 만든 규칙) 때문에 처음엔 403이 떴는데, 이는 버그가 아니라 정상 동작이라 테스트 스크립트에서 계정을 backdate해서 성공 경로까지 확인.

## 상태

- [x] 1단계: 모노레포 초기화 (pnpm workspace, turbo, docker-compose, .env.example)
- [x] 2단계: apps/api 스캐폴딩 + Prisma 스키마/마이그레이션/seed
- [x] 3단계: infra(prisma/redis/storage), common(guards/filters/decorators)
- [x] 4단계: auth, user 모듈
- [x] 5단계: product 모듈
- [x] 6단계: report 모듈
- [x] 7단계: chat 모듈
- [x] 8단계: apps/web
- [x] 9단계: 테스트

### 테스트 (9단계)

실행 명령은 위 [실행 방법 > 4. 테스트 실행](#4-테스트-실행)을 참고하세요. 아래는 설계 노트입니다.

- e2e는 dev DB를 건드리지 않도록 별도 DB(`secondhand_market_test`)와 별도 Redis 논리 DB(`redis://localhost:6379/1`)를 씀.
- `test/jest-e2e.setup.ts`가 `.env.test`를 `ConfigModule` 로딩 전에 주입(`setupFiles`). `LOGIN_THROTTLE`/`SIGNUP_THROTTLE`는 코드 상수라 env로 못 바꿔서, 대신 매 테스트마다 Redis를 flush해 카운터가 테스트 케이스 사이에 새지 않게 함.
- **unit 테스트 중점**: `report.service.spec.ts`가 가장 비중 있음 — "핵심 로직"으로 명시된 트랜잭션 임계치 판정을, `update`의 반환값으로 직접 분기하는지(threshold 도달 시에만 두 번째 update 호출) 정확히 검증. `auth.service.spec.ts`는 refresh 회전/탈취 탐지, `chat.service.spec.ts`는 방 중복 생성 방지·요금제한, `product.pagination.spec.ts`는 커서 인코딩/디코딩과 seek 조건 생성을 순수 함수 단위로 검증.
- **e2e 테스트 중점**: `report.e2e-spec.ts`가 실제 HTTP + 실제 DB로 "서로 다른 5개 계정이 신고 → 5번째에 자동 DORMANT/BLOCKED 전환"까지 재현. 로그인 대신 `JwtService`로 토큰을 직접 발급해 반복 로그인으로 인한 로그인 rate limit 소모를 피함. `auth.e2e-spec.ts`는 회원가입→로그인→보호된 라우트 접근→refresh 회전→재사용 시 세션 폐기→로그아웃 전체 플로우.
- 테스트 작성 중 실제로 하나 잡음(엄밀히는 앱이 아니라 테스트 자체의 오류): access token은 refresh token과 달리 `jti`가 없어서 같은 초(second)에 발급되면 바이트 단위로 같을 수 있음 — 이건 access token이 상태 비교 없이 매번 서명만 검증하는 stateless 토큰이라 문제 없는데, 처음 테스트에서 "refresh 후 access token이 달라야 한다"고 잘못 단언해서 실패했었음. 원인 파악 후 그 단언을 제거(진짜 보장되어야 할 건 refresh token의 유일성이고, 이건 이미 `jti`로 보장됨).
