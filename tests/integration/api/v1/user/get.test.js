import orchestrator from "tests/orchestrator.js";
import setCookieParser from "set-cookie-parser";
import { version as uuidVersion } from "uuid";
import session from "models/session.js";
beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/user", () => {
  describe("Default user", () => {
    test("With valid session", async () => {
      const createdUser = await orchestrator.createUser({
        username: "UserWithValidSession",
      });
      const sessionObject = await orchestrator.createSession(createdUser.id);

      const response = await fetch("Http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: createdUser.id,
        username: "UserWithValidSession",
        email: createdUser.email,
        password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: createdUser.updated_at.toISOString(),
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();

      //Session renewal asseertions
      const renewedSessionObjetct = await session.findOneValidByToken(
        sessionObject.token,
      );
      expect(
        renewedSessionObjetct.expires_at > sessionObject.expires_at,
      ).toEqual(true);
      expect(
        renewedSessionObjetct.updated_at > sessionObject.updated_at,
      ).toEqual(true);

      // Set-Cookie assertions

      const parsedSetCookie = setCookieParser(response, {
        map: true,
      });
      expect(parsedSetCookie.session_id).toEqual({
        name: "session_id",
        value: sessionObject.token,
        maxAge: session.EXPIRATION_IN_MILLISECONDS / 1000,
        path: "/",
        httpOnly: true,
      });
    });
    test("With a half-life token", async () => {
      const fifteenDay = 15 * 24 * 60 * 60 * 1000;

      jest.useFakeTimers({
        now: new Date() - fifteenDay,
      });
      const createdUser = await orchestrator.createUser({
        username: "halfLifeToken",
      });
      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();

      const response = await fetch("Http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: createdUser.id,
        username: "halfLifeToken",
        email: createdUser.email,
        password: createdUser.password,
        created_at: createdUser.created_at.toISOString(),
        updated_at: createdUser.updated_at.toISOString(),
      });

      const renewedSessionObjetct = await session.findOneValidByToken(
        sessionObject.token,
      );

      expect(renewedSessionObjetct.expires_at > sessionObject.expires_at).toBe(
        true,
      );
      expect(renewedSessionObjetct.updated_at > sessionObject.updated_at).toBe(
        true,
      );
    });
    test("With nonexistend session", async () => {
      const nonexistendToken =
        "f77dcb1e371d07f6f9fe7f1917fd12a1354f76ccd96e2bebe161651e89b5368570606d7b1a8970249c4264d68ca53f37";
      const response = await fetch("Http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${nonexistendToken}`,
        },
      });

      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError.",
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
        status_code: 401,
      });
    });
    test("With expired session", async () => {
      jest.useFakeTimers({
        now: new Date() - session.EXPIRATION_IN_MILLISECONDS,
      });
      const createdUser = await orchestrator.createUser({
        username: "UserWithExpiredSession",
      });
      const sessionObject = await orchestrator.createSession(createdUser.id);

      jest.useRealTimers();
      const response = await fetch("Http://localhost:3000/api/v1/user", {
        headers: {
          Cookie: `session_id=${sessionObject.token}`,
        },
      });

      expect(response.status).toBe(401);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "UnauthorizedError.",
        message: "Usuário não possui sessão ativa.",
        action: "Verifique se este usuário está logado e tente novamente.",
        status_code: 401,
      });
    });
  });
});
