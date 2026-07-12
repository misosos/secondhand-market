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

공유 타입 패키지 빌드 (최초 1회 필수 — `dev` 서버는 자동으로 빌드해주지 않습니다):

```bash
pnpm --filter @secondhand/types build
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

> **주의:** `packages/types`(`@secondhand/types`)는 소스가 아니라 컴파일된 `dist/`를 통해 소비됩니다. 이 패키지의 타입을 추가/수정한 뒤에는 `pnpm --filter @secondhand/types build`를 다시 실행해야 `apps/api`/`apps/web`에 반영됩니다. 자주 건드린다면 별도 터미널에서 `pnpm --filter @secondhand/types dev`(watch 모드)를 띄워두면 편합니다.

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
| 공유 타입 패키지 빌드 (수정 후 필수) | `pnpm --filter @secondhand/types build` |
| Prisma 마이그레이션 적용 | `pnpm --filter api prisma:migrate` |
| Prisma Studio (DB GUI) | `pnpm --filter api exec prisma studio` |
| 관리자 계정 지정 | `pnpm --filter api promote-admin <username>` |
| unit 테스트 | `pnpm --filter api test` |
| e2e 테스트 | `pnpm --filter api test:e2e` |
