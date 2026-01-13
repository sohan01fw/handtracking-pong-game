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
    ghostCooldown = 0,
    tripleCooldown = 0,
    decoys = [],
    powerMessage = ""
}) {
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

                {/* Charge Bars */}
                <Rect
                    x={20}
                    y={580}
                    width={150 * (playerCooldown > 0 ? playerCooldown / 600 : playerCharge / 100)}
                    height={8}
                    fill={playerCooldown > 0 ? "#555" : "#00ff88"}
                    cornerRadius={4}
                    shadowBlur={playerCooldown > 0 ? 0 : 10}
                    shadowColor="#00ff88"
                />
                <Text
                    x={20}
                    y={565}
                    text={playerCooldown > 0 ? `COOLDOWN (${Math.ceil(playerCooldown / 60)}s)` : "CHARGE"}
                    fontSize={10}
                    fill={playerCooldown > 0 ? "#ff3366" : "#00ff88"}
                    fontFamily="monospace"
                />

                <Rect
                    x={800 - 20 - (150 * (opponentCooldown > 0 ? opponentCooldown / 600 : opponentCharge / 100))}
                    y={580}
                    width={150 * (opponentCooldown > 0 ? opponentCooldown / 600 : opponentCharge / 100)}
                    height={8}
                    fill={opponentCooldown > 0 ? "#555" : "#ff3366"}
                    cornerRadius={4}
                    shadowBlur={opponentCooldown > 0 ? 0 : 10}
                    shadowColor="#ff3366"
                />
                <Text
                    x={800 - 170}
                    y={565}
                    width={150}
                    align="right"
                    text={opponentCooldown > 0 ? `COOLDOWN (${Math.ceil(opponentCooldown / 60)}s)` : "CHARGE"}
                    fontSize={10}
                    fill={opponentCooldown > 0 ? "#ff3366" : "#ff3366"}
                    fontFamily="monospace"
                />

                {/* New Power Cooldowns */}
                <Group x={20} y={530}>
                    <Text text="GHOST" fontSize={10} fill={ghostCooldown > 0 ? "#555" : "#00ffff"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (ghostCooldown > 0 ? ghostCooldown / 1200 : 1)} height={4} fill={ghostCooldown > 0 ? "#222" : "#00ffff"} />
                </Group>

                <Group x={100} y={530}>
                    <Text text="TRIPLE" fontSize={10} fill={tripleCooldown > 0 ? "#555" : "#ffaa00"} fontFamily="monospace" />
                    <Rect y={12} width={60 * (tripleCooldown > 0 ? tripleCooldown / 600 : 1)} height={4} fill={tripleCooldown > 0 ? "#222" : "#ffaa00"} />
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
                    text="YOU"
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
                    text="AI"
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
