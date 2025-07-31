import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { JSX } from 'react';
import '../../../screens/LobbyScreen/LobbyScreen.css';

export default function GoogleOAuthCallback(): JSX.Element {
  const navigate = useNavigate();
  const effectRan = useRef(false);

  useEffect(() => {
    // StrictMode에서 두 번 실행되는 것을 방지
    if (effectRan.current === true) {
      return;
    }
    effectRan.current = true;

    console.log('[OAuthCallback] 컴포넌트 실행');

    if (!window.location.hash) {
      console.log('[OAuthCallback] URL 해시가 없음, 인증 실패');
      navigate('/');
      return;
    }

    const params = new URLSearchParams(window.location.hash.substring(1));

    console.log('[OAuthCallback] URL 해시 파싱 완료:', window.location.hash);

    const returnedState = params.get('state');
    const savedState = localStorage.getItem('oauth_state');

    console.log('[OAuthCallback] returnedState:', returnedState);
    console.log('[OAuthCallback] savedState(localStorage):', savedState);

    if (returnedState !== savedState) {
      console.warn('[OAuthCallback] state 불일치, 잘못된 접근');
      alert('잘못된 접근입니다');

      // 해시는 여기서도 제거해줍니다.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      console.log('[OAuthCallback] URL 해시 제거 완료');

      navigate('/');
      return;
    }

    localStorage.removeItem('oauth_state');
    console.log('[OAuthCallback] 세션 저장소의 oauth_state 제거');

    const idToken = params.get('id_token');
    console.log('[OAuthCallback] id_token:', idToken);

    if (idToken) {
      fetch('https://api.lexionline.minsung.kr/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errorMsg = await res.text();
            throw new Error(errorMsg || '로그인 실패');
          }
          return res.json();
        })
        .then((data) => {
          // 로그인 성공 처리
          localStorage.setItem('access_token', data.token);
          // 해시 제거는 로그인 성공 후 여기서 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          console.log('[OAuthCallback] URL 해시 제거 완료');
          navigate('/');
        })
        .catch((err) => {
          console.error('서버 로그인 실패:', err);
          alert('로그인에 실패했습니다.');
          // 해시 제거는 오류 시에도 단 한 번만
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          console.log('[OAuthCallback] URL 해시 제거 완료');
          navigate('/');
        });
    } else {
      console.error('[OAuthCallback] id_token이 없음');
      alert('로그인에 실패했습니다.');
      // 해시 제거도 단 한 번만
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      console.log('[OAuthCallback] URL 해시 제거 완료');
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="lobby-screen">
      <div className="loading-container">
        <div className="loading-spinner-large"></div>
        <p style={{ 
          margin: 0, 
          opacity: 0.8, 
          fontSize: '1.2vw', 
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          fontWeight: '400'
        }}>
          인증 처리 중...
        </p>
      </div>
    </div>
  );
}
