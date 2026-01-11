import { Stage, Layer, Circle, Rect, Text, Line } from 'react-konva';

import { Html } from 'react-konva-utils';

export default function GameCanvas({ playerPaddle, opponentPaddle, ball, score, winningScore, winner, onReset, handLandmarks, debugInfo }) {
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
                    fill="#ffaa00"
                    shadowBlur={30}
                    shadowColor="#ffaa00"
                />

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
