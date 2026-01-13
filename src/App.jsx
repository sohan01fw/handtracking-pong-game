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
    const [gameState, setGameState] = useState('menu'); // 'menu', 'modeSelect', 'playing'
    const [controlMode, setControlMode] = useState('hand'); // 'hand', 'keyboard'

    const { videoRef, handPosition, isReady } = useHandTracking(gameState === 'playing' && controlMode === 'hand');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [musicEnabled, setMusicEnabled] = useState(true);

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

    // Power-up state
    const [playerCharge, setPlayerCharge] = useState(0);
    const [opponentCharge, setOpponentCharge] = useState(0);
    const [playerCooldown, setPlayerCooldown] = useState(0);
    const [opponentCooldown, setOpponentCooldown] = useState(0);
    const [ghostCooldown, setGhostCooldown] = useState(0);
    const [tripleCooldown, setTripleCooldown] = useState(0);
    const [ghostActive, setGhostActive] = useState(0); // Timer for ghost mode
    const [decoys, setDecoys] = useState([]); // Array of fake balls
    const [powerMessage, setPowerMessage] = useState("");

    const playerWasSqueezing = useRef(false);
    const playerWasTwoFingers = useRef(false);
    const playerWasThreeFingers = useRef(false);
    const fingerHistory = useRef([]);
    const playerHitSinceReset = useRef(false);
    const opponentWasCharging = useRef(false);
    const playerReleaseTime = useRef(0);
    const opponentReleaseTime = useRef(0);

    const animationRef = useRef();
    const keysPressed = useRef({});

    useEffect(() => {
        const handleKeyDown = (e) => { keysPressed.current[e.key.toLowerCase()] = true; };
        const handleKeyUp = (e) => { keysPressed.current[e.key.toLowerCase()] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const gameLoop = () => {
            if (winner || gameState !== 'playing') return;

            let action;
            if (controlMode === 'hand') {
                action = processHandInput(handPosition, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else {
                // Keyboard Input Logic
                const speed = 8;
                let newY = playerPaddle.y;
                if (keysPressed.current['w'] || keysPressed.current['arrowup']) newY -= speed;
                if (keysPressed.current['s'] || keysPressed.current['arrowdown']) newY += speed;

                action = {
                    object_action: "move_paddle",
                    action_value: newY + PADDLE_HEIGHT / 2,
                    isSqueezing: keysPressed.current[' '],
                    raisedFingers: keysPressed.current['q'] ? 2 : (keysPressed.current['e'] ? 3 : 0),
                    notes: "Keyboard Mode: W/S to move, Space to Charge, Q for Ghost (2F), E for Triple (3F)"
                };
            }
            setActionData(action);

            if (action.object_action === 'move_paddle') {
                setPlayerPaddle(prev => ({
                    ...prev,
                    y: Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, action.action_value - PADDLE_HEIGHT / 2))
                }));
            }

            // Gesture stability logic
            fingerHistory.current.push(action.raisedFingers);
            if (fingerHistory.current.length > 5) fingerHistory.current.shift();
            const stableFingers = fingerHistory.current.every(v => v === action.raisedFingers) ? action.raisedFingers : null;

            // Cooldown logic
            setPlayerCooldown(prev => Math.max(0, prev - 1));
            setOpponentCooldown(prev => Math.max(0, prev - 1));
            setGhostCooldown(prev => Math.max(0, prev - 1));
            setTripleCooldown(prev => Math.max(0, prev - 1));
            setGhostActive(prev => Math.max(0, prev - 1));

            // Power Triggers (using stable fingers to prevent flickering)
            if (stableFingers === 2 && !playerWasTwoFingers.current && ghostCooldown <= 0 && ball.velocityX > 0) {
                setGhostActive(120); // 2 seconds of invisibility
                setGhostCooldown(1200); // 20s
                setPowerMessage("GHOST BALL!");
                setTimeout(() => setPowerMessage(""), 1000);
            }
            playerWasTwoFingers.current = stableFingers === 2;

            if (stableFingers === 3 && !playerWasThreeFingers.current && tripleCooldown <= 0 && ball.velocityX > 0 && playerHitSinceReset.current) {
                setDecoys([
                    {
                        x: ball.x,
                        y: ball.y,
                        velocityX: ball.velocityX * (0.8 + Math.random() * 0.4),
                        velocityY: (Math.random() - 0.5) * 15,
                        id: Math.random()
                    },
                    {
                        x: ball.x,
                        y: ball.y,
                        velocityX: ball.velocityX * (0.8 + Math.random() * 0.4),
                        velocityY: (Math.random() - 0.5) * 15,
                        id: Math.random()
                    }
                ]);
                setTripleCooldown(600); // 10s
                setPowerMessage("TRIPLE THREAT!");
                playerHitSinceReset.current = false; // Reset after use
                setTimeout(() => setPowerMessage(""), 1000);
            }
            playerWasThreeFingers.current = stableFingers === 3;

            // Update Decoys Logic
            setDecoys(prev => prev.map(d => {
                let nx = d.x + d.velocityX;
                let ny = d.y + d.velocityY;
                let nvx = d.velocityX;
                let nvy = d.velocityY;
                if (ny < 0 || ny > CANVAS_HEIGHT) nvy = -nvy;
                return { ...d, x: nx, y: ny, velocityX: nvx, velocityY: nvy };
            }).filter(d => d.x > 0 && d.x < CANVAS_WIDTH));

            // User charging logic (only if not on cooldown)
            if (action.isSqueezing && playerCooldown <= 0) {
                setPlayerCharge(prev => Math.min(100, prev + 1.5));
            } else {
                if (playerWasSqueezing.current) {
                    playerReleaseTime.current = Date.now();
                }
                setPlayerCharge(prev => Math.max(0, prev - 1));
            }
            playerWasSqueezing.current = action.isSqueezing;

            // Opponent AI logic
            const aiControl = updateOpponentPaddle(ball.y, opponentPaddle.y, PADDLE_HEIGHT, ball.x, CANVAS_WIDTH, ball.velocityX);
            setOpponentPaddle(prev => ({
                ...prev,
                y: Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, aiControl.y))
            }));

            // AI charging logic (only if not on cooldown)
            if (aiControl.shouldCharge && opponentCooldown <= 0) {
                setOpponentCharge(prev => Math.min(100, prev + 1.2));
                opponentWasCharging.current = true;
            } else {
                if (opponentWasCharging.current && aiControl.shouldRelease) {
                    opponentReleaseTime.current = Date.now();
                }
                opponentWasCharging.current = false;
                setOpponentCharge(prev => Math.max(0, prev - 1));
            }

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

                    let multiplier = 1;
                    const timeSinceRelease = Date.now() - playerReleaseTime.current;
                    if (timeSinceRelease < 400 && playerCharge > 30 && playerCooldown <= 0) {
                        multiplier = 3.5;
                        setPlayerCharge(0);
                        setPlayerCooldown(600);
                        setPowerMessage("POWER BLAST!");
                        setTimeout(() => setPowerMessage(""), 1000);
                    }

                    newVelocityX = Math.abs(newVelocityX) * multiplier;
                    newX = playerPaddle.x + PADDLE_WIDTH + BALL_RADIUS;
                    const hitPos = (newY - playerPaddle.y) / PADDLE_HEIGHT - 0.5;
                    newVelocityY += hitPos * 5;
                    playerHitSinceReset.current = true; // Mark as hit by player
                    if (soundEnabled) paddleHitSound.play().catch(() => { });
                }

                if (newX + BALL_RADIUS > opponentPaddle.x &&
                    newX - BALL_RADIUS < opponentPaddle.x + PADDLE_WIDTH &&
                    newY > opponentPaddle.y &&
                    newY < opponentPaddle.y + PADDLE_HEIGHT) {

                    let multiplier = 1;
                    const timeSinceRelease = Date.now() - opponentReleaseTime.current;
                    if (timeSinceRelease < 400 && opponentCharge > 30 && opponentCooldown <= 0) {
                        multiplier = 3.5;
                        setOpponentCharge(0);
                        setOpponentCooldown(600);
                        setPowerMessage("AI BLAST!");
                        setTimeout(() => setPowerMessage(""), 1000);
                    }

                    newVelocityX = -Math.abs(newVelocityX) * multiplier;
                    newX = opponentPaddle.x - BALL_RADIUS;
                    const hitPos = (newY - opponentPaddle.y) / PADDLE_HEIGHT - 0.5;
                    newVelocityY += hitPos * 5;
                    if (soundEnabled) paddleHitSound.play().catch(() => { });
                }

                if (newX < 0) {
                    setScore(s => {
                        const newOpponentScore = s.opponent + 1;
                        if (newOpponentScore >= WINNING_SCORE) {
                            setWinner('AI');
                            if (soundEnabled) winSound.play().catch(() => { });
                        }
                        return { ...s, opponent: newOpponentScore };
                    });
                    playerHitSinceReset.current = false;
                    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: BALL_RADIUS, velocityX: 5, velocityY: 3 };
                }

                if (newX > CANVAS_WIDTH) {
                    setScore(s => {
                        const newPlayerScore = s.player + 1;
                        if (newPlayerScore >= WINNING_SCORE) {
                            setWinner('YOU');
                            if (soundEnabled) winSound.play().catch(() => { });
                        }
                        return { ...s, player: newPlayerScore };
                    });
                    playerHitSinceReset.current = false;
                    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, radius: BALL_RADIUS, velocityX: -5, velocityY: 3 };
                }

                newVelocityY = Math.max(-15, Math.min(15, newVelocityY));
                newVelocityX = Math.max(-35, Math.min(35, (newVelocityX < 0 ? Math.min(-5, newVelocityX) : Math.max(5, newVelocityX))));

                if (newX < 100 || newX > CANVAS_WIDTH - 100) {
                    setDecoys([]);
                }

                return {
                    ...prev,
                    x: newX,
                    y: newY,
                    velocityX: newVelocityX,
                    velocityY: newVelocityY,
                    isPowered: Math.abs(newVelocityX) > 12,
                    isGhost: ghostActive > 0 && newVelocityX > 0
                };
            });

            animationRef.current = requestAnimationFrame(gameLoop);
        };

        animationRef.current = requestAnimationFrame(gameLoop);
        return () => cancelAnimationFrame(animationRef.current);
    }, [handPosition, ball, playerPaddle, opponentPaddle, winner, gameState, controlMode, soundEnabled]);

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
        setPlayerCharge(0);
        setOpponentCharge(0);
        setPlayerCooldown(0);
        setOpponentCooldown(0);
        setGhostCooldown(0);
        setTripleCooldown(0);
        setGhostActive(0);
        setDecoys([]);
    };

    const handleExit = () => {
        if (window.confirm("Are you sure you want to exit?")) {
            setGameState('menu');
            resetGame();
        }
    };

    const menuButtonStyle = {
        padding: '15px 40px',
        fontSize: '20px',
        background: 'rgba(0, 255, 136, 0.1)',
        color: '#00ff88',
        border: '2px solid #00ff88',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: 'bold',
        width: '250px',
        transition: 'all 0.3s ease',
        textShadow: '0 0 10px #00ff88',
        boxShadow: '0 0 15px rgba(0, 255, 136, 0.2)',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '2px'
    };

    const secondaryButtonStyle = {
        ...menuButtonStyle,
        background: 'rgba(255, 51, 102, 0.1)',
        color: '#ff3366',
        border: '2px solid #ff3366',
        textShadow: '0 0 10px #ff3366',
        boxShadow: '0 0 15px rgba(255, 51, 102, 0.2)',
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
            padding: '20px',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {gameState === 'menu' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '25px',
                    zIndex: 10,
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <h1 style={{
                        color: '#00ff88',
                        fontSize: '4rem',
                        margin: '0 0 20px 0',
                        textShadow: '0 0 30px #00ff88',
                        letterSpacing: '10px'
                    }}>
                        PONG.AI
                    </h1>
                    <button
                        style={menuButtonStyle}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(0, 255, 136, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(0, 255, 136, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(0, 255, 136, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.2)'; }}
                        onClick={() => setGameState('modeSelect')}
                    >
                        START GAME
                    </button>
                    <button
                        style={secondaryButtonStyle}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(255, 51, 102, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(255, 51, 102, 0.2)'; }}
                        onClick={() => setMusicEnabled(!musicEnabled)}
                    >
                        MUSIC: {musicEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                        style={secondaryButtonStyle}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(255, 51, 102, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(255, 51, 102, 0.2)'; }}
                        onClick={() => setSoundEnabled(!soundEnabled)}
                    >
                        SOUND: {soundEnabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                        style={secondaryButtonStyle}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(255, 51, 102, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(255, 51, 102, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(255, 51, 102, 0.2)'; }}
                        onClick={() => window.close()}
                    >
                        EXIT
                    </button>
                </div>
            )}

            {gameState === 'modeSelect' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '40px',
                    zIndex: 10,
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <h2 style={{ color: '#00ff88', fontSize: '2.5rem', textShadow: '0 0 20px #00ff88' }}>CHOOSE CONTROL</h2>
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div
                            onClick={() => { setControlMode('hand'); setGameState('playing'); }}
                            style={{
                                padding: '30px',
                                border: '2px solid #00ff88',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                                background: 'rgba(0, 255, 136, 0.05)',
                                width: '280px'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>✋</div>
                            <h3 style={{ color: '#00ff88', marginBottom: '10px' }}>HAND GESTURE</h3>
                            <p style={{ color: '#888', fontSize: '14px' }}>
                                Move hand up/down. <br />
                                2 Fingers: Ghost Ball <br />
                                3 Fingers: Triple Ball (after hit)
                            </p>
                        </div>
                        <div
                            onClick={() => { setControlMode('keyboard'); setGameState('playing'); }}
                            style={{
                                padding: '30px',
                                border: '2px solid #00ffff',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                                background: 'rgba(0, 255, 255, 0.05)',
                                width: '280px'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>⌨️</div>
                            <h3 style={{ color: '#00ffff', marginBottom: '10px' }}>KEYBOARD</h3>
                            <p style={{ color: '#888', fontSize: '14px' }}>W/S to move, Space to Charge, Q/E for Powers.</p>
                        </div>
                    </div>
                    <button
                        style={{ ...secondaryButtonStyle, width: '150px' }}
                        onClick={() => setGameState('menu')}
                    >
                        BACK
                    </button>
                </div>
            )}

            {gameState === 'playing' && (
                <>
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0 40px',
                        position: 'absolute',
                        top: '20px'
                    }}>
                        <h1 style={{ color: '#00ff88', fontSize: '1.5rem', margin: 0, textShadow: '0 0 20px #00ff88' }}>
                            PONG.AI
                        </h1>
                        <button
                            style={{ ...secondaryButtonStyle, padding: '5px 15px', fontSize: '12px', width: 'auto' }}
                            onClick={handleExit}
                        >
                            QUIT
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginTop: '40px' }}>
                        {controlMode === 'hand' && (
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
                        )}

                        <GameCanvas
                            playerPaddle={playerPaddle}
                            opponentPaddle={opponentPaddle}
                            ball={ball}
                            score={score}
                            winningScore={WINNING_SCORE}
                            winner={winner}
                            onReset={resetGame}
                            handLandmarks={controlMode === 'hand' ? handPosition?.landmarks : null}
                            debugInfo={actionData}
                            playerCharge={playerCharge}
                            opponentCharge={opponentCharge}
                            playerCooldown={playerCooldown}
                            opponentCooldown={opponentCooldown}
                            ghostCooldown={ghostCooldown}
                            tripleCooldown={tripleCooldown}
                            decoys={decoys}
                            powerMessage={powerMessage}
                        />
                    </div>

                    <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                        {controlMode === 'hand'
                            ? (isReady ? '✋ Move hand up/down | ✌️ 2 Fingers: Ghost | 🤟 3 Fingers: Triple (after hit)' : '⏳ Waiting for camera permission...')
                            : '⌨️ Use W/S or Arrow Keys to move, Space to Charge power!'}
                    </p>
                </>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
