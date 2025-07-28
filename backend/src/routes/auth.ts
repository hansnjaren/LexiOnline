import express, { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../prisma/client"; // 프로젝트 구조에 맞게 경로 조정
import jwt from "jsonwebtoken";

const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET; // 실제 환경변수로 설정하세요

// POST /api/auth/google
router.post("/auth/google", async (req: Request, res: Response) => {
  console.log("✅ [POST] /api/auth/google 진입");
  
  let token;
  if (typeof req.body === 'string') {
    try {
      const parsedBody = JSON.parse(req.body);
      token = parsedBody.token;
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON format in request body" });
    }
  } else {
    token = req.body.token;
  }

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // 1) 구글 id_token 검증
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const googleId = payload.sub;
    const now = new Date();

    // 2) DB 내 기존 사용자 조회
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      // 신규 가입
      user = await prisma.user.create({
        data: {
          googleId,
          nickname: payload.name || "Anonymous",
          profileImageUrl: payload.picture,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        },
      });
    } else {
      // 기존 로그인 -> 마지막 로그인 시간 업데이트
      user = await prisma.user.update({
        where: { googleId },
        data: { lastLoginAt: now, updatedAt: now },
      });
    }

    // 3) 자체 JWT 토큰 생성 (payload에 googleId 필드를 넣음)
    const appToken = jwt.sign(
      {
        userId: user.id,
        googleId: user.googleId,      // 기존 sub 대신 googleId 사용
        nickname: user.nickname,
      },
      JWT_SECRET,
      { expiresIn: "1d" } // 토큰 만료 기간
    );

    // 4) 클라이언트에 JWT 및 유저정보 응답
    res.json({
      token: appToken,
      user: {
        id: user.id,
        googleId: user.googleId,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// OPTIONS /api/auth/google - CORS preflight 요청 처리
router.options("/auth/google", (req, res) => {
  // 허용할 Origin 헤더 설정
  const allowedOrigins = [
    "http://localhost:3000",
    "https://lexi-online.vercel.app",
    "https://lexionline.minsung.kr",
    "https://34.111.207.27"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

// GET /api/userinfo
router.get('/userinfo', async (req: Request, res: Response) => {
  try {
    // 1) Authorization 헤더에서 토큰 빼오기
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1]; // Bearer 토큰 분리
    if (!token) return res.status(401).json({ message: 'Malformed token' });

    // 2) 자체 JWT 비밀키로 토큰 검증
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // 3) JWT 페이로드 내 googleId로 DB 조회
    const googleId = decoded.googleId;  // sub가 아니라 googleId 필드 사용
    if (!googleId) return res.status(400).json({ message: 'No googleId in token' });

    // 4) DB에서 googleId 기준으로 User 찾기 (Prisma 사용)
    const user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 5) 유저 정보를 프론트로 반환 (필요한 필드만)
    res.json({ user: {
      id: user.id,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      lastLoginAt: user.lastLoginAt,
      rating_mu: user.rating_mu,
      rating_sigma: user.rating_sigma,
      // 필요 시 더 추가 가능
    }});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 에러' });
  }
});

export default router;
