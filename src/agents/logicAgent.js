export function processHandInput(handPosition, canvasWidth, canvasHeight) {
    if (!handPosition) {
        return {
            object_action: "stop",
            action_value: 0,
            notes: "no hand detected"
        };
    }

    const targetY = handPosition.y * canvasHeight;

    return {
        object_action: "move_paddle",
        action_value: targetY,
        notes: `hand y: ${targetY.toFixed(0)}`
    };
}

export function updateOpponentPaddle(ballY, paddleY, paddleHeight) {
    const paddleCenter = paddleY + paddleHeight / 2;
    const diff = ballY - paddleCenter;
    const speed = 4;

    if (Math.abs(diff) < 5) {
        return paddleY;
    }

    if (diff > 0) {
        return paddleY + speed;
    } else {
        return paddleY - speed;
    }
}
