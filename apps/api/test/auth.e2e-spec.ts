import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, cleanDatabase, flushRedis } from "./utils";

describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await flushRedis(app); // clears stale throttle counters from prior runs
  });

  afterEach(async () => {
    await cleanDatabase(app);
    await flushRedis(app); // resets SIGNUP_THROTTLE/LOGIN_THROTTLE between test cases
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it("supports the full signup -> login -> protected access -> refresh-rotation -> logout lifecycle", async () => {
    await request(server())
      .post("/api/auth/signup")
      .send({ username: "e2ealice", password: "password123" })
      .expect(201);

    const login = await request(server())
      .post("/api/auth/login")
      .send({ username: "e2ealice", password: "password123" })
      .expect(200);

    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));
    expect(login.body.user).toMatchObject({ username: "e2ealice" });
    expect(login.body.user).not.toHaveProperty("password");

    await request(server()).get("/api/users/me").expect(401);

    const me = await request(server())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.username).toBe("e2ealice");

    const refreshed = await request(server())
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    // Only the refresh token is guaranteed unique per issuance (it carries
    // a jti specifically so rotation/reuse-detection can't collide, see
    // auth.service.ts). The access token has no jti — it's stateless and
    // never compared against a stored value, so two issued in the same
    // wall-clock second can legitimately be byte-identical; that's not a
    // security property worth asserting on here.
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    // Reusing the now-rotated-out refresh token is treated as theft and
    // kills the whole session — including the token that replaced it.
    await request(server())
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    await request(server())
      .post("/api/auth/refresh")
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);

    const secondLogin = await request(server())
      .post("/api/auth/login")
      .send({ username: "e2ealice", password: "password123" })
      .expect(200);

    await request(server())
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${secondLogin.body.accessToken}`)
      .expect(204);

    await request(server())
      .post("/api/auth/refresh")
      .send({ refreshToken: secondLogin.body.refreshToken })
      .expect(401);
  });

  it("rejects a duplicate username with 409", async () => {
    await request(server())
      .post("/api/auth/signup")
      .send({ username: "dupuser", password: "password123" })
      .expect(201);

    await request(server())
      .post("/api/auth/signup")
      .send({ username: "dupuser", password: "password123" })
      .expect(409);
  });

  it("rejects an unknown user and a wrong password with the same 401 (no user enumeration)", async () => {
    await request(server())
      .post("/api/auth/signup")
      .send({ username: "realuser", password: "password123" })
      .expect(201);

    const unknownUserRes = await request(server())
      .post("/api/auth/login")
      .send({ username: "nosuchuser", password: "password123" })
      .expect(401);

    const wrongPasswordRes = await request(server())
      .post("/api/auth/login")
      .send({ username: "realuser", password: "wrongpassword" })
      .expect(401);

    expect(unknownUserRes.body.message).toBe(wrongPasswordRes.body.message);
  });

  it("rejects signup with a missing password with 400", async () => {
    await request(server()).post("/api/auth/signup").send({ username: "nopassworduser" }).expect(400);
  });
});
