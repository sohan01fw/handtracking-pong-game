import { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { processHandInput, updateOpponentPaddle } from './agents/logicAgent';
import { useHandTracking } from './hooks/useHandTracking';
import { useMultiplayer } from './hooks/useMultiplayer';
import { CONSTANTS } from './game/constants';
import { updateSinglePlayer } from './game/singlePlayer';
import { updateMultiplayerHost } from './game/multiPlayer';
import { updatePhysics } from './game/physics';
import { updatePowerCooldowns } from './game/powerLogic';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_RADIUS = 10;
const WINNING_SCORE = 20;

// Sound effects
const paddleHitSound = new Audio('/sounds/paddle_hit.wav');
const winSound = new Audio('/sounds/win.wav');
const bgMusic = new Audio('/sounds/masso.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4; // Set to a comfortable background level

export default function App() {
    const [gameState, setGameState] = useState('menu'); // 'menu', 'mpMenu', 'lobby', 'modeSelect', 'playing'
    const [controlMode, setControlMode] = useState('hand'); // 'hand', 'keyboard'
    const [isMultiplayer, setIsMultiplayer] = useState(false);
    const mp = useMultiplayer();
    const prevConnStatus = useRef('disconnected');
    const prevGameState = useRef('menu');
    const lastReceivedTime = useRef(Date.now());
    const gameStartTime = useRef(0);
    const intentionalDisconnect = useRef(false);
    const [toast, setToast] = useState({ message: '', visible: false });
    const [showExitModal, setShowExitModal] = useState(false);

    const showToast = useCallback((message) => {
        setToast({ message, visible: true });
        setTimeout(() => setToast({ message: '', visible: false }), 4000);
    }, []);

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
    const [playerGhostCooldown, setPlayerGhostCooldown] = useState(0);
    const [opponentGhostCooldown, setOpponentGhostCooldown] = useState(0);
    const [playerTripleCooldown, setPlayerTripleCooldown] = useState(0);
    const [opponentTripleCooldown, setOpponentTripleCooldown] = useState(0);
    const [ghostActive, setGhostActive] = useState(0); // Timer for ghost mode
    const [ghostOwner, setGhostOwner] = useState(null); // 'player' or 'opponent'
    const [decoys, setDecoys] = useState([]); // Array of fake balls
    const [powerMessage, setPowerMessage] = useState("");

    const playerWasSqueezing = useRef(false);
    const playerWasTwoFingers = useRef(false);
    const playerWasThreeFingers = useRef(false);
    const fingerHistory = useRef([]);
    const playerHitSinceReset = useRef(false);
    const opponentHitSinceReset = useRef(false);
    const opponentWasCharging = useRef(false);
    const opponentWasTwoFingers = useRef(false);
    const opponentWasThreeFingers = useRef(false);
    const opponentFingerHistory = useRef([]);
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

    // Music control effect
    useEffect(() => {
        if (musicEnabled) {
            bgMusic.play().catch(error => {
                console.log("Autoplay prevented. Music will start after user interaction.", error);
            });
        } else {
            bgMusic.pause();
        }
    }, [musicEnabled, gameState]);

    // Handle join link on mount OR when peer is finally ready
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('join');
        const mode = urlParams.get('mode');
        if (joinId && mp.myId && !isMultiplayer) {
            console.log("Found join ID and Peer is ready, connecting...");
            if (mode) setControlMode(mode);
            setIsMultiplayer(true);
            mp.setIsHost(false);
            mp.connectToPeer(joinId);
            setGameState('lobby'); // Move to lobby
        }
    }, [mp.myId]); // Effect runs when myId is generated

    // Handle disconnections and timeouts
    useEffect(() => {
        // 1. Manual PeerJS disconnect
        const statusLost = isMultiplayer &&
            mp.connectionStatus === 'disconnected' &&
            prevConnStatus.current === 'connected';

        // 2. Timeout check (ONLY during active playing state)
        // We add a 2 second grace period after state change to playing
        const timeInPlaying = gameState === 'playing' ? Date.now() - gameStartTime.current : 0;
        const timeoutLost = isMultiplayer &&
            mp.connectionStatus === 'connected' &&
            gameState === 'playing' &&
            timeInPlaying > 2000 && // Grace period for game loop to start
            (Date.now() - lastReceivedTime.current > 5000);

        if (statusLost || timeoutLost) {
            console.log("Multiplayer connection lost:", statusLost ? "PeerJS Close" : "Timeout");

            // If we didn't intentionally disconnect, it means the OTHER person left/timed out.
            if (!intentionalDisconnect.current) {
                if (isMultiplayer) {
                    showToast("Opponent disconnected.");
                }
                // Force return to menu for the person who stayed
                setGameState('menu');
                setIsMultiplayer(false);
                mp.setIsHost(false);
                prevConnStatus.current = 'disconnected';
                window.history.replaceState({}, '', window.location.pathname);
            }
            // If we DID intentionally disconnect, we've already handled our own state reset in performExit.

            intentionalDisconnect.current = false; // Reset for next session
            return;
        }

        // Reset tracking if not in multiplayer
        if (!isMultiplayer) {
            prevConnStatus.current = 'disconnected';
            lastReceivedTime.current = Date.now();
            return;
        }

        // Reset heartbeat timer when connection is first established OR game starts
        if (mp.connectionStatus === 'connected' &&
            (prevConnStatus.current !== 'connected' || (gameState === 'playing' && prevGameState.current !== 'playing'))) {
            lastReceivedTime.current = Date.now();
            if (gameState === 'playing') gameStartTime.current = Date.now();
        }

        prevConnStatus.current = mp.connectionStatus;
        prevGameState.current = gameState;
    }, [mp.connectionStatus, isMultiplayer, gameState, mp.connectionStatus]);

    // Separate effect for timeout interval
    useEffect(() => {
        if (!isMultiplayer || mp.connectionStatus !== 'connected' || gameState === 'menu') return;

        const interval = setInterval(() => {
            if (Date.now() - lastReceivedTime.current > 5000) {
                // Trigger a re-render/check in the status effect
                setGameState(prev => prev);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isMultiplayer, mp.connectionStatus, gameState]);

    // Handle Multiplayer Data
    useEffect(() => {
        if (!mp.receivedData || intentionalDisconnect.current) return;
        lastReceivedTime.current = Date.now(); // Update heartbeat
        const data = mp.receivedData;

        // Handle explicit disconnect notice
        if (data.type === 'disconnect_notice') {
            console.log("Received disconnect notice from opponent");
            showToast("Opponent disconnected.");
            setGameState('menu');
            setIsMultiplayer(false);
            mp.setIsHost(false);
            window.history.replaceState({}, '', window.location.pathname);
            prevConnStatus.current = 'disconnected';
            return;
        }

        if (mp.isHost && data.type === 'paddle_update') {
            setOpponentPaddle(prev => ({ ...prev, y: data.y }));
            setOpponentCharge(data.charge);

            // Update gesture history for stability checks in game loop
            if (data.raisedFingers !== undefined) {
                opponentFingerHistory.current.push(data.raisedFingers);
                if (opponentFingerHistory.current.length > 5) opponentFingerHistory.current.shift();
            }

            // Handle guest "release" for blast
            if (opponentWasCharging.current && !data.isSqueezing) {
                opponentReleaseTime.current = Date.now();
            }
            opponentWasCharging.current = data.isSqueezing;
        } else if (mp.isHost && data.type === 'reset_request') {
            resetGame();
        } else if (!mp.isHost && data.type === 'game_state') {
            setBall(data.ball);
            setOpponentPaddle(prev => ({ ...prev, y: data.p1Y }));
            setOpponentCharge(data.p1Charge);
            setScore(data.score);
            setWinner(data.winner);
            setPowerMessage(data.powerMessage);
            setGhostActive(data.ghostActive);
            setGhostOwner(data.ghostOwner === 'player' ? 'opponent' : 'player'); // Map owner relative to us
            setDecoys(data.decoys);
            setPlayerCooldown(data.p2Cooldown);
            setOpponentCooldown(data.p1Cooldown);
            setPlayerGhostCooldown(data.p2GhostCooldown);
            setOpponentGhostCooldown(data.p1GhostCooldown);
            setPlayerTripleCooldown(data.p2TripleCooldown);
            setOpponentTripleCooldown(data.p1TripleCooldown);

            // Sync control and state from host
            if (data.controlMode) setControlMode(data.controlMode);
            if (data.gameState) setGameState(data.gameState);
        }
    }, [mp.receivedData, mp.isHost]);

    // Sync state/mode from Host to Guest during lobby phase
    useEffect(() => {
        if (!isMultiplayer || mp.connectionStatus !== 'connected') return;

        const sendLobbyData = () => {
            if (mp.isHost) {
                mp.sendData({
                    type: 'lobby_sync',
                    gameState,
                    controlMode
                });
            } else {
                // Guest sends a heartbeat ping
                mp.sendData({ type: 'lobby_ping' });
            }
            lastReceivedTime.current = Date.now(); // Reset local tracking too
        };

        // Send immediately on dependency change
        sendLobbyData();

        // Also send periodically in lobby to keep connection alive and heartbeat fresh
        const interval = setInterval(() => {
            if (gameState === 'lobby' || gameState === 'mpMenu') {
                sendLobbyData();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [gameState, controlMode, isMultiplayer, mp.isHost, mp.connectionStatus]);

    // Handle lobby sync on guest and ping on host
    useEffect(() => {
        if (!mp.receivedData) return;
        const data = mp.receivedData;

        // Update heartbeat for any received data (sync or ping)
        lastReceivedTime.current = Date.now();

        if (!mp.isHost && data.type === 'lobby_sync') {
            if (data.gameState) setGameState(data.gameState);
            if (data.controlMode) setControlMode(data.controlMode);
        }
    }, [mp.receivedData, mp.isHost]);

    // Setup paddle positions based on role
    useEffect(() => {
        if (isMultiplayer) {
            if (mp.isHost) {
                setPlayerPaddle(p => ({ ...p, x: 30 }));
                setOpponentPaddle(p => ({ ...p, x: CANVAS_WIDTH - 30 - PADDLE_WIDTH }));
            } else {
                setPlayerPaddle(p => ({ ...p, x: CANVAS_WIDTH - 30 - PADDLE_WIDTH }));
                setOpponentPaddle(p => ({ ...p, x: 30 }));
            }
        }
    }, [isMultiplayer, mp.isHost]);

    useEffect(() => {
        const gameLoop = () => {
            if (winner || gameState !== 'playing') return;

            // 1. Update Powers and Inputs (Paddles, Charges, Cooldowns)
            const updateState = {
                setPlayerPaddle, setOpponentPaddle,
                setPlayerCharge, setOpponentCharge,
                setGhostActive, setGhostOwner, setDecoys,
                setPlayerGhostCooldown, setOpponentGhostCooldown,
                setPlayerTripleCooldown, setOpponentTripleCooldown,
                setPowerMessage
            };

            const refs = {
                playerWasSqueezing, opponentWasCharging,
                playerReleaseTime, opponentReleaseTime,
                playerHitSinceReset, opponentHitSinceReset,
                opponentFingerHistory, fingerHistory,
                decoys
            };

            const cooldowns = {
                playerCooldown, opponentCooldown,
                playerGhostCooldown, opponentGhostCooldown,
                playerTripleCooldown, opponentTripleCooldown,
                ghostActive
            };

            // Decrement Cooldowns (Running every frame)
            const nextCooldowns = updatePowerCooldowns(cooldowns);
            setPlayerCooldown(nextCooldowns.playerCooldown);
            setOpponentCooldown(nextCooldowns.opponentCooldown);
            setPlayerGhostCooldown(nextCooldowns.playerGhostCooldown);
            setOpponentGhostCooldown(nextCooldowns.opponentGhostCooldown);
            setPlayerTripleCooldown(nextCooldowns.playerTripleCooldown);
            setOpponentTripleCooldown(nextCooldowns.opponentTripleCooldown);
            setGhostActive(nextCooldowns.ghostActive);
            if (nextCooldowns.ghostActive === 0 && ghostActive > 0) setGhostOwner(null);

            let action = null; // For debug display

            if (isMultiplayer) {
                if (mp.isHost) {
                    updateMultiplayerHost({
                        ball, playerPaddle, opponentPaddle,
                        playerCharge, opponentCharge,
                        cooldowns, keysPressed, handPosition,
                        controlMode, processHandInput,
                        updateState, refs, mp
                    });
                } else {
                    // Guest Logic: Just send input and sync paddle locally
                    let guestAction;
                    if (controlMode === 'hand') {
                        guestAction = processHandInput(handPosition, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
                    } else {
                        // Keyboard Input Logic (Guest)
                        const speed = 8;
                        let newY = playerPaddle.y; // Guest is 'player' locally
                        if (keysPressed.current['w'] || keysPressed.current['arrowup']) newY -= speed;
                        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) newY += speed;

                        guestAction = {
                            object_action: "move_paddle",
                            action_value: newY + CONSTANTS.PADDLE_HEIGHT / 2,
                            isSqueezing: keysPressed.current[' '],
                            raisedFingers: keysPressed.current['q'] ? 2 : (keysPressed.current['e'] ? 3 : 0)
                        };
                    }
                    action = guestAction;
                    setActionData(action);

                    if (guestAction.object_action === 'move_paddle') {
                        setPlayerPaddle(prev => ({
                            ...prev,
                            y: Math.max(0, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.PADDLE_HEIGHT, guestAction.action_value - CONSTANTS.PADDLE_HEIGHT / 2))
                        }));
                    }

                    // Guest Charge Preview
                    if (guestAction.isSqueezing && playerCooldown <= 0) {
                        setPlayerCharge(prev => Math.min(100, prev + 1.5));
                    } else {
                        setPlayerCharge(prev => Math.max(0, prev - 1));
                    }

                    // Send Data
                    mp.sendData({
                        type: 'paddle_update',
                        y: Math.max(0, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.PADDLE_HEIGHT, guestAction.action_value - CONSTANTS.PADDLE_HEIGHT / 2)),
                        isSqueezing: guestAction.isSqueezing,
                        charge: playerCharge,
                        raisedFingers: guestAction.raisedFingers
                    });

                    animationRef.current = requestAnimationFrame(gameLoop);
                    return;
                }
            } else {
                // Single Player
                const result = updateSinglePlayer({
                    ball, playerPaddle, opponentPaddle, score,
                    playerCharge, opponentCharge,
                    cooldowns, keysPressed, handPosition,
                    controlMode, processHandInput,
                    updateState, refs
                });
                action = result.playerAction;
                setActionData(action);
            }

            // 2. Physics & Ball Update (Host or SP)
            if (!isMultiplayer || mp.isHost) {
                setBall(prevBall => {
                    const physicsState = updatePhysics({
                        ball: prevBall,
                        playerPaddle, opponentPaddle,
                        playerCharge, opponentCharge,
                        playerCooldown, opponentCooldown,
                        ghostActive, ghostOwner,
                        soundEnabled,
                        refs,
                        setters: {
                            setScore, setWinner, // setBall not needed, we return new ball
                            setPlayerCharge, setOpponentCharge,
                            setPlayerCooldown, setOpponentCooldown,
                            setPowerMessage, setDecoys
                        },
                        callbacks: { paddleHitSound, winSound }
                    });
                    return physicsState;
                });

                // Host Sync Send
                if (isMultiplayer && mp.isHost) {
                    mp.sendData({
                        type: 'game_state',
                        ball,
                        p1Y: playerPaddle.y,
                        p1Charge: playerCharge,
                        score,
                        winner,
                        powerMessage,
                        ghostActive,
                        ghostOwner,
                        decoys,
                        p1Cooldown: playerCooldown,
                        p2Cooldown: opponentCooldown,
                        p1GhostCooldown: playerGhostCooldown,
                        p2GhostCooldown: opponentGhostCooldown,
                        p1TripleCooldown: playerTripleCooldown,
                        p2TripleCooldown: opponentTripleCooldown,
                        controlMode,
                        gameState
                    });
                }
            }

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
        setGhostCooldown(0); // Deprecated but safe
        setPlayerGhostCooldown(0);
        setOpponentGhostCooldown(0);
        setPlayerTripleCooldown(0);
        setOpponentTripleCooldown(0);
        setGhostActive(0);
        setGhostOwner(null);
        setDecoys([]);
    };

    const performExit = useCallback(() => {
        // 1. Close modal IMMEDIATELY to give feedback
        setShowExitModal(false);

        // 2. Perform destructive logic in next tick to avoid blocking UI update
        setTimeout(() => {
            // Mark as intentional to suppress disconnect toast
            intentionalDisconnect.current = true;

            // Clear network traces
            window.history.replaceState({}, '', window.location.pathname);

            // Reset Game & cleanup
            setGameState('menu');
            setIsMultiplayer(false);
            if (mp && mp.setIsHost) mp.setIsHost(false);

            // Send Goodbye message if connection is still open
            if (mp && mp.sendData) {
                try { mp.sendData({ type: 'disconnect_notice' }); } catch (e) { /* ignore */ }
            }

            resetGame();

            // Finally disconnect
            if (mp && mp.disconnect) mp.disconnect();
        }, 50);
    }, [mp]);

    const handleExitClick = () => {
        setShowExitModal(true);
    };

    const handleExit = () => {
        if (isMultiplayer) {
            handleExitClick();
        } else {
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
                        PONG
                    </h1>
                    <button
                        style={menuButtonStyle}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(0, 255, 136, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(0, 255, 136, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(0, 255, 136, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(0, 255, 136, 0.2)'; }}
                        onClick={() => { setIsMultiplayer(false); setGameState('modeSelect'); }}
                    >
                        SINGLE PLAYER
                    </button>
                    <button
                        style={{ ...menuButtonStyle, border: '2px solid #00ffff', color: '#00ffff', textShadow: '0 0 10px #00ffff', boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)' }}
                        onMouseOver={(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.2)'; e.target.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.4)'; }}
                        onMouseOut={(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.1)'; e.target.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)'; }}
                        onClick={() => {
                            setGameState('mpMenu');
                        }}
                    >
                        2 PLAYER (P2P)
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

            {gameState === 'mpMenu' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '25px',
                    zIndex: 10,
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <h2 style={{ color: '#00ffff', fontSize: '2.5rem', textShadow: '0 0 20px #00ffff' }}>MULTIPLAYER</h2>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        <button
                            style={{ ...menuButtonStyle, border: '2px solid #00ffff', color: '#00ffff' }}
                            onClick={() => {
                                setIsMultiplayer(true);
                                mp.setIsHost(true);
                                setGameState('lobby');
                            }}
                        >
                            HOST GAME
                        </button>
                        <button
                            style={{ ...menuButtonStyle, border: '2px solid #00ffff', color: '#00ffff' }}
                            onClick={() => {
                                const input = prompt("Enter Host ID (or Paste Join Link):");
                                if (input) {
                                    let finalId = input;
                                    // Try to parse ID from URL if they pasted the whole link
                                    try {
                                        if (input.includes('?join=')) {
                                            const url = new URL(input.startsWith('http') ? input : `http://${input}`);
                                            finalId = url.searchParams.get('join');
                                            const mode = url.searchParams.get('mode');
                                            if (mode) setControlMode(mode);
                                        }
                                    } catch (e) {
                                        console.log("Could not parse as URL, using raw input as ID");
                                    }

                                    if (finalId) {
                                        setIsMultiplayer(true);
                                        mp.setIsHost(false);
                                        mp.connectToPeer(finalId);
                                        setGameState('lobby');
                                    }
                                }
                            }}
                        >
                            JOIN GAME
                        </button>
                    </div>

                    <button
                        style={{ ...secondaryButtonStyle, width: '150px' }}
                        onClick={() => {
                            if (isMultiplayer) {
                                handleExitClick();
                            } else {
                                setGameState('menu');
                            }
                        }}
                    >
                        BACK
                    </button>
                </div>
            )}

            {gameState === 'lobby' && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '25px',
                    zIndex: 10,
                    animation: 'fadeIn 0.5s ease-out',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '40px',
                    borderRadius: '20px',
                    border: '2px solid #00ffff',
                    boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)'
                }}>
                    <h2 style={{ color: '#00ffff', fontSize: '2rem', textShadow: '0 0 20px #00ffff' }}>CREATE MULTIPLAYER</h2>

                    <div style={{ textAlign: 'center', color: '#888', marginBottom: '10px' }}>
                        {mp.connectionStatus === 'disconnected' && "INITIALIZING PEER..."}
                        {mp.connectionStatus === 'connecting' && "WAITING FOR OPPONENT..."}
                        {mp.connectionStatus === 'connected' && "CONNECTED!"}
                    </div>

                    {mp.myId && (
                        <>
                            {mp.isHost && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '15px',
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '10px 20px',
                                    borderRadius: '30px',
                                    border: '1px solid #333',
                                    marginBottom: '10px'
                                }}>
                                    <span style={{ color: '#888' }}>CHOOSE CONTROL:</span>
                                    <button
                                        style={{
                                            padding: '8px 15px',
                                            background: controlMode === 'hand' ? '#00ff88' : 'transparent',
                                            color: controlMode === 'hand' ? '#000' : '#888',
                                            border: '1px solid #00ff88',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() => setControlMode('hand')}
                                    >✋ HAND</button>
                                    <button
                                        style={{
                                            padding: '8px 15px',
                                            background: controlMode === 'keyboard' ? '#00ffff' : 'transparent',
                                            color: controlMode === 'keyboard' ? '#000' : '#888',
                                            border: '1px solid #00ffff',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() => setControlMode('keyboard')}
                                    >⌨️ KEYS</button>
                                </div>
                            )}

                            {mp.isHost ? (
                                <div style={{ background: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #333', width: '300px', cursor: 'pointer' }}
                                    onClick={() => {
                                        const url = `${window.location.origin}${window.location.pathname}?join=${mp.myId}&mode=${controlMode}`;
                                        navigator.clipboard.writeText(url);
                                        // Toast could be used here too if needed, but keeping it silent for now
                                        showToast("Join link copied!");
                                    }}>
                                    <p style={{ color: '#555', margin: '0 0 5px 0', fontSize: '10px' }}>YOUR JOIN LINK (CLICK TO COPY)</p>
                                    <p style={{ color: '#00ffff', margin: 0, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {window.location.host}/?join={mp.myId}&mode={controlMode}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ background: 'rgba(0, 255, 136, 0.1)', padding: '20px', borderRadius: '15px', border: '1px solid #00ff88', width: '300px', textAlign: 'center' }}>
                                    <p style={{ color: '#00ff88', margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
                                        {mp.connectionStatus === 'connected' ? "CONNECTED TO HOST!" : "CONNECTING..."}
                                    </p>
                                    <p style={{ color: '#888', margin: '5px 0 0 0', fontSize: '12px' }}>
                                        {mp.connectionStatus === 'connected' ? "Waiting for host to start match..." : "Please wait while we establish connection."}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {!mp.myId && <div style={{ color: '#ff3366' }}>Generating Peer ID...</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', alignItems: 'center' }}>
                        {mp.isHost && (
                            <button
                                disabled={mp.connectionStatus !== 'connected'}
                                style={{
                                    ...menuButtonStyle,
                                    width: '250px',
                                    background: mp.connectionStatus === 'connected' ? '#00ffff' : '#222',
                                    color: mp.connectionStatus === 'connected' ? '#000' : '#444',
                                    border: mp.connectionStatus === 'connected' ? '2px solid #00ffff' : '2px solid #333',
                                    cursor: mp.connectionStatus === 'connected' ? 'pointer' : 'not-allowed',
                                    boxShadow: mp.connectionStatus === 'connected' ? '0 0 20px rgba(0, 255, 255, 0.4)' : 'none'
                                }}
                                onClick={() => setGameState('playing')}
                            >
                                {mp.connectionStatus === 'connected' ? "START MATCH" : "WAITING FOR OPPONENT"}
                            </button>
                        )}

                        <button
                            style={{ ...secondaryButtonStyle, width: '150px' }}
                            onClick={() => {
                                if (isMultiplayer) {
                                    handleExitClick();
                                } else {
                                    setGameState('menu');
                                }
                            }}
                        >
                            CANCEL
                        </button>
                    </div>
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
                    <h2 style={{ color: '#00ff88', fontSize: '2.5rem', textShadow: '0 0 20px #00ff88' }}>
                        {isMultiplayer && !mp.isHost ? "WAITING FOR HOST..." : "CHOOSE CONTROL"}
                    </h2>
                    {isMultiplayer && !mp.isHost && (
                        <p style={{ color: '#888' }}>The host is selecting the control mode for this match.</p>
                    )}
                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div
                            onClick={() => {
                                if (isMultiplayer && !mp.isHost) return;
                                setControlMode('hand');
                                setGameState('playing');
                            }}
                            style={{
                                padding: '30px',
                                border: '2px solid #00ff88',
                                borderRadius: '20px',
                                cursor: (isMultiplayer && !mp.isHost) ? 'default' : 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                                background: 'rgba(0, 255, 136, 0.05)',
                                width: '280px',
                                opacity: (isMultiplayer && !mp.isHost) ? 0.5 : 1
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
                            onClick={() => {
                                if (isMultiplayer && !mp.isHost) return;
                                setControlMode('keyboard');
                                setGameState('playing');
                            }}
                            style={{
                                padding: '30px',
                                border: '2px solid #00ffff',
                                borderRadius: '20px',
                                cursor: (isMultiplayer && !mp.isHost) ? 'default' : 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.3s',
                                background: 'rgba(0, 255, 255, 0.05)',
                                width: '280px',
                                opacity: (isMultiplayer && !mp.isHost) ? 0.5 : 1
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
                        onClick={() => {
                            if (isMultiplayer) {
                                handleExitClick();
                            } else {
                                setGameState('menu');
                            }
                        }}
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
                        top: '20px',
                        zIndex: 2000
                    }}>
                        <h1 style={{ color: '#00ff88', fontSize: '1.5rem', margin: 0, textShadow: '0 0 20px #00ff88' }}>
                            PONG
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
                            onReset={() => {
                                if (isMultiplayer && !mp.isHost) {
                                    mp.sendData({ type: 'reset_request' });
                                } else {
                                    resetGame();
                                }
                            }}
                            handLandmarks={controlMode === 'hand' ? handPosition?.landmarks : null}
                            debugInfo={actionData}
                            playerCharge={playerCharge}
                            opponentCharge={opponentCharge}
                            playerCooldown={playerCooldown}
                            opponentCooldown={opponentCooldown}
                            playerGhostCooldown={playerGhostCooldown}
                            opponentGhostCooldown={opponentGhostCooldown}
                            playerTripleCooldown={playerTripleCooldown}
                            opponentTripleCooldown={opponentTripleCooldown}
                            decoys={decoys}
                            powerMessage={powerMessage}
                            isMultiplayer={isMultiplayer}
                            isHost={mp.isHost}
                        />
                    </div>

                    <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
                        {controlMode === 'hand'
                            ? (isReady ? '✋ Move hand up/down | ✌️ 2 Fingers: Ghost | 🤟 3 Fingers: Triple (after hit)' : '⏳ Waiting for camera permission...')
                            : '⌨️ Use W/S or Arrow Keys to move, Space to Charge power!'}
                    </p>
                </>
            )
            }

            {showExitModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: '#111',
                        padding: '40px',
                        borderRadius: '20px',
                        border: '2px solid #ff3366',
                        boxShadow: '0 0 40px rgba(255, 51, 102, 0.4)',
                        textAlign: 'center',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h2 style={{ color: '#ff3366', fontSize: '1.8rem', marginBottom: '20px' }}>EXIT MATCH?</h2>
                        <p style={{ color: '#888', marginBottom: '30px' }}>Are you sure you want to leave this match? This will end the session for both players.</p>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <button
                                style={{ ...menuButtonStyle, width: '120px', fontSize: '16px', background: '#ff3366', color: '#fff', border: 'none' }}
                                onClick={performExit}
                            >YES</button>
                            <button
                                style={{ ...secondaryButtonStyle, width: '120px', fontSize: '16px' }}
                                onClick={() => setShowExitModal(false)}
                            >NO</button>
                        </div>
                    </div>
                </div>
            )}

            {toast.visible && (
                <div style={{
                    position: 'fixed',
                    bottom: '40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 51, 102, 0.95)',
                    color: '#fff',
                    padding: '12px 25px',
                    borderRadius: '30px',
                    border: '1px solid #ff3366',
                    boxShadow: '0 0 25px rgba(255, 51, 102, 0.6)',
                    zIndex: 2000,
                    animation: 'fadeInUp 0.3s ease-out',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    letterSpacing: '1px',
                    pointerEvents: 'none'
                }}>
                    ⚠️ {toast.message.toUpperCase()}
                </div>
            )}

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div >
    );
}
