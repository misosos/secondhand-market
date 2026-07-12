import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ReportTargetType } from "@secondhand/types";
import { createTestApp, cleanDatabase, flushRedis, backdateUser } from "./utils";

const MIN_REPORTER_ACCOUNT_AGE_MS = 10 * 60 * 1000;

// CsrfGuard is a stateless double-submit check (cookie must echo the
// X-CSRF-Token header) — it doesn't tie the pair to a real session, so
// these tests can fabricate one instead of going through /auth/login for
// every reporter (which would burn the 5/min LOGIN_THROTTLE, see
// signupAndMint below).
const CSRF_TOKEN = "e2e-test-csrf-token";

describe("Report (e2e) — transactional auto-moderation", () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    app = await createTestApp();
    await flushRedis(app);
    jwtService = app.get(JwtService);
  });

  afterEach(async () => {
    await cleanDatabase(app);
    // SIGNUP_THROTTLE/LOGIN_THROTTLE are hardcoded constants (not env-driven),
    // and this suite's test cases collectively create more than 10 users —
    // reset the counters between tests so throttling doesn't leak across
    // otherwise-independent test cases.
    await flushRedis(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  // Mints a valid access token directly rather than going through
  // /auth/login: the login flow itself is covered by auth.e2e-spec.ts, and
  // routing every reporter through login here would burn into the 5/min
  // login throttle for no reason relevant to what this suite verifies.
  async function signupAndMint(username: string, backdateMs = 0) {
    const signupRes = await request(server())
      .post("/api/auth/signup")
      .send({ username, password: "password123" })
      .expect(201);

    if (backdateMs > 0) {
      await backdateUser(app, username, backdateMs);
    }

    const token = jwtService.sign({ sub: signupRes.body.id, username });
    return { id: signupRes.body.id as string, token };
  }

  it("requires a non-empty reason (DTO validation)", async () => {
    const reporter = await signupAndMint("reasonreporter", MIN_REPORTER_ACCOUNT_AGE_MS * 2);
    const target = await signupAndMint("reasontarget");

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({ targetType: ReportTargetType.USER, targetId: target.id })
      .expect(400);
  });

  it("blocks a freshly created account from filing a report", async () => {
    const reporter = await signupAndMint("freshreporter"); // no backdate
    const target = await signupAndMint("freshtarget");

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({ targetType: ReportTargetType.USER, targetId: target.id, reason: "spam" })
      .expect(403);
  });

  it("blocks self-reports on both user and product targets", async () => {
    const user = await signupAndMint("selfreporter", MIN_REPORTER_ACCOUNT_AGE_MS * 2);

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ targetType: ReportTargetType.USER, targetId: user.id, reason: "x" })
      .expect(400);

    const product = await request(server())
      .post("/api/products")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        name: "own product",
        description: "d",
        price: 1000,
        imageUrls: ["https://example.com/a.jpg"],
      })
      .expect(201);

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ targetType: ReportTargetType.PRODUCT, targetId: product.body.id, reason: "x" })
      .expect(400);
  });

  it("rejects a duplicate report on the same target with 409", async () => {
    const reporter = await signupAndMint("dupreporter", MIN_REPORTER_ACCOUNT_AGE_MS * 2);
    const target = await signupAndMint("duptarget");

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({ targetType: ReportTargetType.USER, targetId: target.id, reason: "spam" })
      .expect(201);

    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({ targetType: ReportTargetType.USER, targetId: target.id, reason: "spam again" })
      .expect(409);
  });

  it("auto-restricts a user (DORMANT) the moment 5 distinct reports land, and a product (BLOCKED) the same way", async () => {
    const target = await signupAndMint("floodtarget");
    const reporters = await Promise.all(
      Array.from({ length: 5 }, (_, i) => signupAndMint(`flooder${i}`, MIN_REPORTER_ACCOUNT_AGE_MS * 2)),
    );

    // Below threshold: still ACTIVE.
    for (let i = 0; i < 4; i++) {
      await request(server())
        .post("/api/reports")
        .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
        .set("x-csrf-token", CSRF_TOKEN)
        .set("Authorization", `Bearer ${reporters[i].token}`)
        .send({ targetType: ReportTargetType.USER, targetId: target.id, reason: `report ${i}` })
        .expect(201);
    }

    // The public GET /users/:id route deliberately excludes status/balance/
    // role (see UserService.getPublicSummary) — /users/me is the only route
    // that still exposes status, so check it as the target itself.
    const stillActive = await request(server())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);
    expect(stillActive.body.status).toBe("ACTIVE");

    // 5th distinct report crosses REPORT_BLOCK_THRESHOLD (5 in .env.test).
    await request(server())
      .post("/api/reports")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${reporters[4].token}`)
      .send({ targetType: ReportTargetType.USER, targetId: target.id, reason: "report 4" })
      .expect(201);

    const nowDormant = await request(server())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);
    expect(nowDormant.body.status).toBe("DORMANT");

    // The restriction actually takes effect elsewhere in the system too.
    await request(server())
      .post("/api/auth/login")
      .send({ username: "floodtarget", password: "password123" })
      .expect(403);
  });

  it("auto-blocks a product listing once its report count crosses the threshold", async () => {
    const seller = await signupAndMint("productseller", MIN_REPORTER_ACCOUNT_AGE_MS * 2);
    const product = await request(server())
      .post("/api/products")
      .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
      .set("x-csrf-token", CSRF_TOKEN)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        name: "flagged product",
        description: "d",
        price: 5000,
        imageUrls: ["https://example.com/a.jpg"],
      })
      .expect(201);

    const reporters = await Promise.all(
      Array.from({ length: 5 }, (_, i) => signupAndMint(`preporter${i}`, MIN_REPORTER_ACCOUNT_AGE_MS * 2)),
    );

    for (const reporter of reporters) {
      await request(server())
        .post("/api/reports")
        .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
        .set("x-csrf-token", CSRF_TOKEN)
        .set("Authorization", `Bearer ${reporter.token}`)
        .send({ targetType: ReportTargetType.PRODUCT, targetId: product.body.id, reason: "fake" })
        .expect(201);
    }

    // BLOCKED listings are excluded from public detail — same behavior a
    // deleted product gets.
    await request(server()).get(`/api/products/${product.body.id}`).expect(404);
  });
});
