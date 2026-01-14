import { Stage, Layer, Circle, Rect, Text, Line, Group } from 'react-konva';

import { Html } from 'react-konva-utils';

export default function GameCanvas({
    playerPaddle,
    opponentPaddle,
    ball,
    score,
    winningScore,
    winner,
    onReset,
    handLandmarks,
    debugInfo,
    playerCharge = 0,
    opponentCharge = 0,
    playerCooldown = 0,
    opponentCooldown = 0,
    playerGhostCooldown = 0,
    opponentGhostCooldown = 0,
    playerTripleCooldown = 0,
    opponentTripleCooldown = 0,
    decoys = [],
    powerMessage = "",
    isMultiplayer = false,
    isHost = false
}) {

    // Determine P1 (Left) and P2 (Right) state based on role
    // If Host/Single: Player is Left (P1), Opponent is Right (P2)
    // If Guest: Opponent (Host) is Left (P1), Player (Us) is Right (P2)

    // P1 (Left Side)
    const p1Ghost = (!isMultiplayer || isHost) ? playerGhostCooldown : opponentGhostCooldown;
    const p1Triple = (!isMultiplayer || isHost) ? playerTripleCooldown : opponentTripleCooldown;
    const p1Charge = (!isMultiplayer || isHost) ? playerCharge : opponentCharge;
    const p1Cooldown = (!isMultiplayer || isHost) ? playerCooldown : opponentCooldown;

    // P2 (Right Side)
    const p2Ghost = (!isMultiplayer || isHost) ? opponentGhostCooldown : playerGhostCooldown;
    const p2Triple = (!isMultiplayer || isHost) ? opponentTripleCooldown : playerTripleCooldown;
    const p2Charge = (!isMultiplayer || isHost) ? opponentCharge : playerCharge;
    const p2Cooldown = (!isMultiplayer || isHost) ? opponentCooldown : playerCooldown;

    return (
        <Stage width={800} height={600} style={{ border: '2px solid #222' }}>
            <Layer>
                <Rect x={0} y={0} width={800} height={600} fill="#0a0a0a" />

                <Line
                    points={[400, 0, 400, 600]}
                    stroke="#333"
                    strokeWidth={2}
                    dash={[10, 10]}
                />

                <Rect
                    x={playerPaddle.x}
                    y={playerPaddle.y}
                    width={playerPaddle.width}
                    height={playerPaddle.height}
                    fill="#00ff88"
                    cornerRadius={4}
                    shadowBlur={20}
                    shadowColor="#00ff88"
                />

                <Rect
                    x={opponentPaddle.x}
                    y={opponentPaddle.y}
                    width={opponentPaddle.width}
                    height={opponentPaddle.height}
                    fill="#ff3366"
                    cornerRadius={4}
                    shadowBlur={20}
                    shadowColor="#ff3366"
                />

                <Circle
                    x={ball.x}
                    y={ball.y}
                    radius={ball.radius}
                    fill={ball.isPowered ? "#00ffff" : "#ffaa00"}
                    opacity={ball.isGhost ? 0 : 1}
                    shadowBlur={ball.isPowered ? 50 : 30}
                    shadowColor={ball.isPowered ? "#00ffff" : "#ffaa00"}
                />

                {/* Decoys */}
                {decoys.map(d => (
                    <Circle
                        key={d.id}
                        x={d.x}
                        y={d.y}
                        radius={ball.radius}
                        fill="#ffaa00"
                        opacity={1}
                    />
                ))}

                {/* Charge Bars - Left (P1) */}
                <Rect
                    x={20}
                    y={580}
                    width={150 * (p1Cooldown > 0 ? p1Cooldown / 600 : p1Charge / 100)}
                    height={8}
                    fill={p1Cooldown > 0 ? "#555" : "#00ff88"}
                    cornerRadius={4}
                    shadowBlur={p1Cooldown > 0 ? 0 : 10}
                    shadowColor="#00ff88"
                />
                <Text
                    x={20}
                    y={565}
                    text={p1Cooldown > 0 ? `COOLDOWN (${Math.ceil(p1Cooldown / 60)}s)` : "CHARGE"}
                    fontSize={10}
                    fill={p1Cooldown > 0 ? "#ff3366" : "#00ff88"}
                    fontFamily="monospace"
                />

                {/* Charge Bars - Right (P2) */}
                <Rect
                    x={800 - 20 - (150 * (p2Cooldown > 0 ? p2Cooldown / 600 : p2Charge / 100))}
                    y={580}
                    width={150 * (p2Cooldown > 0 ? p2Cooldown / 600 : p2Charge / 100)}
                    height={8}
                    fill={p2Cooldown > 0 ? "#555" : "#ff3366"}
                    cornerRadius={4}
                    shadowBlur={p2Cooldown > 0 ? 0 : 10}
                    shadowColor="#ff3366"
                />
                <Text
                    x={800 - 170}
                    y={565}
                    width={150}
                    align="right"
                    text={p2Cooldown > 0 ? `COOLDOWN (${Math.ceil(p2Cooldown / 60)}s)` : "CHARGE"}
                    fontSize={10}
                    fill={p2Cooldown > 0 ? "#ff3366" : "#ff3366"}
                    fontFamily="monospace"
                />

                {/* P1 Power Cooldowns (Left) */}
                <Group x={20} y={530}>
                    <Text text="GHOST" fontSize={10} fill={p1Ghost > 0 ? "#555" : "#00ffff"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (p1Ghost > 0 ? p1Ghost / 1200 : 1)} height={4} fill={p1Ghost > 0 ? "#222" : "#00ffff"} />
                </Group>

                <Group x={100} y={530}>
                    <Text text="TRIPLE" fontSize={10} fill={p1Triple > 0 ? "#555" : "#ffaa00"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (p1Triple > 0 ? p1Triple / 600 : 1)} height={4} fill={p1Triple > 0 ? "#222" : "#ffaa00"} />
                </Group>

                {/* P2 Power Cooldowns (Right) */}
                <Group x={720} y={530}>
                    <Text text="GHOST" fontSize={10} fill={p2Ghost > 0 ? "#555" : "#00ffff"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (p2Ghost > 0 ? p2Ghost / 1200 : 1)} height={4} fill={p2Ghost > 0 ? "#222" : "#00ffff"} />
                </Group>

                <Group x={640} y={530}>
                    <Text text="TRIPLE" fontSize={10} fill={p2Triple > 0 ? "#555" : "#ffaa00"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (p2Triple > 0 ? p2Triple / 600 : 1)} height={4} fill={p2Triple > 0 ? "#222" : "#ffaa00"} />
                </Group>

                {/* Power Message */}
                {powerMessage && (
                    <Text
                        x={0}
                        y={280}
                        width={800}
                        text={powerMessage}
                        fontSize={64}
                        fill="#ffffff"
                        fontFamily="monospace"
                        fontStyle="bold"
                        align="center"
                        shadowBlur={30}
                        shadowColor="#ffffff"
                    />
                )}

                <Text
                    x={300}
                    y={40}
                    text={score.player.toString()}
                    fontSize={48}
                    fill="#00ff88"
                    fontFamily="monospace"
                    fontStyle="bold"
                />

                <Text
                    x={460}
                    y={40}
                    text={score.opponent.toString()}
                    fontSize={48}
                    fill="#ff3366"
                    fontFamily="monospace"
                    fontStyle="bold"
                />

                <Text
                    x={225}
                    y={100}
                    text={isMultiplayer ? (isHost ? "YOU (P1)" : "P1") : "YOU"}
                    fontSize={24}
                    fill="#00ff88"
                    fontFamily="monospace"
                    fontStyle="bold"
                    opacity={0.3}
                    width={150}
                    align="center"
                />

                <Text
                    x={385}
                    y={100}
                    text={isMultiplayer ? (isHost ? "P2" : "YOU (P2)") : "AI"}
                    fontSize={24}
                    fill="#ff3366"
                    fontFamily="monospace"
                    fontStyle="bold"
                    opacity={0.3}
                    width={150}
                    align="center"
                />

                <Text
                    x={0}
                    y={560}
                    width={800}
                    text={`GOAL TO WIN: ${winningScore}`}
                    fontSize={18}
                    fill="#666"
                    fontFamily="monospace"
                    fontStyle="bold"
                    align="center"
                />

                {winner && (
                    <>
                        <Text
                            x={0}
                            y={220}
                            width={800}
                            text={`${winner} WIN!`}
                            fontSize={48}
                            fill={winner === 'YOU' ? '#00ff88' : '#ff3366'}
                            fontFamily="monospace"
                            fontStyle="bold"
                            align="center"
                            shadowBlur={20}
                            shadowColor={winner === 'YOU' ? '#00ff88' : '#ff3366'}
                        />
                        <Html>
                            <div style={{
                                position: 'absolute',
                                top: '320px',
                                left: '400px',
                                transform: 'translateX(-50%)'
                            }}>
                                <button
                                    onClick={onReset}
                                    style={{
                                        padding: '12px 24px',
                                        fontSize: '18px',
                                        backgroundColor: winner === 'YOU' ? '#00ff88' : '#ff3366',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        boxShadow: `0 0 20px ${winner === 'YOU' ? '#00ff8888' : '#ff336688'}`,
                                        transition: 'all 0.2s',
                                        fontFamily: 'monospace'
                                    }}
                                >
                                    PLAY AGAIN
                                </button>
                            </div>
                        </Html>
                    </>
                )}

                {handLandmarks && handLandmarks.map((landmark, i) => (
                    <Circle
                        key={i}
                        x={landmark.x * 800}
                        y={landmark.y * 600}
                        radius={3}
                        fill="#00ff88"
                        opacity={0.6}
                    />
                ))}

                {debugInfo && (
                    <Text
                        x={10}
                        y={10}
                        text={debugInfo.notes}
                        fontSize={12}
                        fill="#666"
                        fontFamily="monospace"
                    />
                )}
            </Layer>
        </Stage>
    );
}
