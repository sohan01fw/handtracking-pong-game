import { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { processHandInput, updateOpponentPaddle } from './agents/logicAgent';
import { useHandTracking } from './hooks/useHandTracking';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_RADIUS = 10;
const WINNING_SCORE = 20;

// Sound effects
const paddleHitSound = new Audio('/sounds/paddle_hit.wav');
const winSound = new Audio('/sounds/win.wav');

export default function App() {
    const { videoRef, handPosition, isReady } = useHandTracking();

    const [playerPaddle, setPlayerPaddle] = useState({
        x: 30,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT
    });

    const [opponentPaddle, setOpponentPaddle] = useState({
        x: CANVAS_WIDTH - 30 - PADDLE_WIDTH,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT
    });

    const [ball, setBall] = useState({
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        radius: BALL_RADIUS,
        velocityX: 5,
        velocityY: 3
    });

    const [score, setScore] = useState({ player: 0, opponent: 0 });
    const [winner, setWinner] = useState(null);
    const [actionData, setActionData] = useState(null);
    const animationRef = useRef();

    useEffect(() => {
        const gameLoop = () => {
            if (winner) return;

            const action = processHandInput(handPosition, CANVAS_WIDTH, CANVAS_HEIGHT);
            setActionData(action);

            if (action.object_action === 'move_paddle') {
                setPlayerPaddle(prev => ({
                    ...prev,
                    y: Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, action.action_value - PADDLE_HEIGHT / 2))
                }));
            }

            setOpponentPaddle(prev => ({
                ...prev,
                y: Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT,
                    updateOpponentPaddle(ball.y, prev.y, PADDLE_HEIGHT)))
            }));

            setBall(prev => {
                let newX = prev.x + prev.velocityX;
                let newY = prev.y + prev.velocityY;
                let newVelocityX = prev.velocityX;
                let newVelocityY = prev.velocityY;

                if (newY - BALL_RADIUS < 0 || newY + BALL_RADIUS > CANVAS_HEIGHT) {
                    newVelocityY = -newVelocityY;
                    newY = Math.max(BALL_RADIUS, Math.min(CANVAS_HEIGHT - BALL_RADIUS, newY));
                }

                if (newX - BALL_RADIUS < playerPaddle.x + PADDLE_WIDTH &&
                    newX + BALL_RADIUS > playerPaddle.x &&
                    newY > playerPaddle.y &&
                    newY < playerPaddle.y + PADDLE_HEIGHT) {
                    newVelocityX = Math.abs(newVelocityX);
                    newX = playerPaddle.x + PADDLE_WIDTH + BALL_RADIUS;
                    const hitPos = (newY - playerPaddle.y) / PADDLE_HEIGHT - 0.5;
                    newVelocityY += hitPos * 5;
                    paddleHitSound.play().catch(() => { });
                }

                if (newX + BALL_RADIUS > opponentPaddle.x &&
                    newX - BALL_RADIUS < opponentPaddle.x + PADDLE_WIDTH &&
                    newY > opponentPaddle.y &&
                    newY < opponentPaddle.y + PADDLE_HEIGHT) {
                    newVelocityX = -Math.abs(newVelocityX);
                    newX = opponentPaddle.x - BALL_RADIUS;
                    const hitPos = (newY - opponentPaddle.y) / PADDLE_HEIGHT - 0.5;
                    newVelocityY += hitPos * 5;
                    paddleHitSound.play().catch(() => { });
                }

                if (newX < 0) {
                    setScore(s => {
                        const newOpponentScore = s.opponent + 1;
                        if (newOpponentScore >= WINNING_SCORE) {
                            setWinner('AI');
                            winSound.play().catch(() => { });
                        }
                        return { ...s, opponent: newOpponentScore };
                    });
                    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: BALL_RADIUS, velocityX: 5, velocityY: 3 };
                }

                if (newX > CANVAS_WIDTH) {
                    setScore(s => {
                        const newPlayerScore = s.player + 1;
                        if (newPlayerScore >= WINNING_SCORE) {
                            setWinner('YOU');
                            winSound.play().catch(() => { });
                        }
                        return { ...s, player: newPlayerScore };
                    });
                    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: BALL_RADIUS, velocityX: -5, velocityY: 3 };
                }

                newVelocityY = Math.max(-10, Math.min(10, newVelocityY));

                return {
                    ...prev,
                    x: newX,
                    y: newY,
                    velocityX: newVelocityX,
                    velocityY: newVelocityY
                };
            });

            animationRef.current = requestAnimationFrame(gameLoop);
        };

        animationRef.current = requestAnimationFrame(gameLoop);
        return () => cancelAnimationFrame(animationRef.current);
    }, [handPosition, ball, playerPaddle, opponentPaddle, winner]);

    const resetGame = () => {
        setScore({ player: 0, opponent: 0 });
        setWinner(null);
        setBall({
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            radius: BALL_RADIUS,
            velocityX: 5,
            velocityY: 3
        });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
            fontFamily: 'monospace',
            gap: '20px',
            padding: '20px'
        }}>
            <h1 style={{ color: '#00ff88', fontSize: '2.5rem', margin: 0, textShadow: '0 0 20px #00ff88' }}>
                Hand Tracking Pong
            </h1>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative' }}>
                    <video
                        ref={videoRef}
                        style={{
                            width: '320px',
                            height: '240px',
                            borderRadius: '10px',
                            border: '2px solid #333',
                            transform: 'scaleX(-1)'
                        }}
                    />
                    {!isReady && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: '#00ff88',
                            fontSize: '14px',
                            textAlign: 'center'
                        }}>
                            Initializing camera...
                        </div>
                    )}
                </div>

                <GameCanvas
                    playerPaddle={playerPaddle}
                    opponentPaddle={opponentPaddle}
                    ball={ball}
                    score={score}
                    winningScore={WINNING_SCORE}
                    winner={winner}
                    onReset={resetGame}
                    handLandmarks={handPosition?.landmarks}
                    debugInfo={actionData}
                />
            </div>

            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                {isReady ? '✋ Move your hand up/down to control the paddle' : '⏳ Waiting for camera permission...'}
            </p>
        </div>
    );
}
