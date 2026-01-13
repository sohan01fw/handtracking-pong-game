export function processHandInput(handPosition, canvasWidth, canvasHeight) {
    if (!handPosition || !handPosition.landmarks) {
        return {
            object_action: "stop",
            action_value: 0,
            isSqueezing: false,
            isSnapping: false,
            raisedFingers: 0,
            notes: "no hand detected"
        };
    }

    const landmarks = handPosition.landmarks;
    const targetY = handPosition.y * canvasHeight;

    const wrist = landmarks[0];
    const tips = [8, 12, 16, 20];
    const knuckles = [5, 9, 13, 17];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];

    const getDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // Squeeze detection
    let totalTipDist = 0;
    let totalKnuckleDist = 0;
    tips.forEach(idx => totalTipDist += getDist(landmarks[idx], wrist));
    knuckles.forEach(idx => totalKnuckleDist += getDist(landmarks[idx], wrist));
    const isSqueezing = totalTipDist < totalKnuckleDist * 1.15;

    // Raised finger count logic
    const isFingerRaised = (tipIdx, mcpIdx) => {
        const tip = landmarks[tipIdx];
        const mcp = landmarks[mcpIdx];
        const distTip = getDist(tip, wrist);
        const distMcp = getDist(mcp, wrist);

        // Stricter check: Tip must be above MCP AND significantly further from wrist
        const yDiff = mcp.y - tip.y;
        return yDiff > 0.05 && distTip > distMcp * 1.25;
    };

    let raisedFingers = 0;
    // Index (8, 5), Middle (12, 9), Ring (16, 13), Pinky (20, 17)
    if (isFingerRaised(8, 5)) raisedFingers++;
    if (isFingerRaised(12, 9)) raisedFingers++;
    if (isFingerRaised(16, 13)) raisedFingers++;
    if (isFingerRaised(20, 17)) raisedFingers++;

    return {
        object_action: "move_paddle",
        action_value: targetY,
        isSqueezing,
        isSnapping: false, // Removed snap detection
        raisedFingers,
        notes: `Fingers: ${raisedFingers} | Squeeze: ${isSqueezing ? 'Y' : 'N'}`
    };
}

export function updateOpponentPaddle(ballY, paddleY, paddleHeight, ballX, canvasWidth, ballVelocityX) {
    const paddleCenter = paddleY + paddleHeight / 2;
    const diff = ballY - paddleCenter;
    const speed = 4;

    let nextY = paddleY;
    if (Math.abs(diff) > 5) {
        nextY = diff > 0 ? paddleY + speed : paddleY - speed;
    }

    // AI Charging Logic: Charge if ball is coming and AI is in position
    const isBallComing = ballVelocityX > 0;
    const isInPosition = Math.abs(diff) < 40;
    const shouldCharge = isBallComing && isInPosition && ballX > canvasWidth / 2 && ballX < canvasWidth - 100;
    const shouldRelease = isBallComing && ballX > canvasWidth - 40;

    return {
        y: nextY,
        shouldCharge,
        shouldRelease
    };
}
