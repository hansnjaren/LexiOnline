import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";

import { MyRoom } from "./rooms/MyRoom";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('my_room', MyRoom);
  },

  initializeExpress: (app) => {
    // 모든 요청 로깅용 전역 미들웨어 추가
    app.use((req, res, next) => {
      console.log(`[Express REQUEST] ${req.method} ${req.url}`);
      next();
    });

    // CORS 설정: 프론트엔드 주소에 맞게 origin 변경
    const corsOptions = {
      origin: [
        "http://localhost:3000",
        "https://lexi-online.vercel.app",
        "https://lexionline.minsung.kr",
        "https://34.111.207.27"
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };

    // CORS 미들웨어 적용 (이 미들웨어가 Preflight 요청을 자동으로 처리합니다)
    app.use(cors(corsOptions));

    // JSON 바디 파싱 미들웨어
    app.use(express.json());

    // API 라우터 등록
    app.use('/api', authRouter);

    // 테스트용 라우트
    app.get("/hello_world", (req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
    });

    // Playground 및 Monitor (비프로덕션)
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground());
    }
    app.use("/monitor", monitor());
  },

  beforeListen: () => {
    // Listen 전 작업이 필요하면 여기에 작성
  }
});
