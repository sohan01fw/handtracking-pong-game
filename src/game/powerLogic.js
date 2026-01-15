import { CONSTANTS } from './constants';

export const POWER_COOLDOWNS = {
    GHOST_DURATION: 120, // Frames
    GHOST_CD: 1200,      // Frames
    TRIPLE_CD: 600,
    BLAST_CD: 600
};

export function updatePowerCooldowns(currentCooldowns) {
    return {
        playerCooldown: Math.max(0, currentCooldowns.playerCooldown - 1),
        opponentCooldown: Math.max(0, currentCooldowns.opponentCooldown - 1),
        playerGhostCooldown: Math.max(0, currentCooldowns.playerGhostCooldown - 1),
        opponentGhostCooldown: Math.max(0, currentCooldowns.opponentGhostCooldown - 1),
        playerTripleCooldown: Math.max(0, currentCooldowns.playerTripleCooldown - 1),
        opponentTripleCooldown: Math.max(0, currentCooldowns.opponentTripleCooldown - 1),
        ghostActive: Math.max(0, currentCooldowns.ghostActive - 1)
    };
}

export function checkPlayerPowerActivation(input, cooldowns, ball, playerHitSinceReset) {
    // Player is always on Left in SP, or Host in MP (Left)
    // So ball moving RIGHT (velX > 0) is moving away from Player
    const ballMovingAway = ball.velocityX > 0;

    // 2 Fingers = Ghost
    if (input.raisedFingers === 2 && cooldowns.playerGhostCooldown <= 0 && ballMovingAway) {
        return 'GHOST';
    }

    // 3 Fingers = Triple (Multiball)
    if (input.raisedFingers === 3 && cooldowns.playerTripleCooldown <= 0 && ballMovingAway && playerHitSinceReset) {
        return 'TRIPLE';
    }

    return null;
}

export function checkOpponentPowerActivation(input, cooldowns, ball, opponentHitSinceReset) {
    // Opponent is Right
    // Ball moving LEFT (velX < 0) is moving away from Opponent
    const ballMovingAway = ball.velocityX < 0;

    if (input.raisedFingers === 2 && cooldowns.opponentGhostCooldown <= 0 && ballMovingAway) {
        return 'GHOST';
    }

    if (input.raisedFingers === 3 && cooldowns.opponentTripleCooldown <= 0 && ballMovingAway && opponentHitSinceReset) {
        return 'TRIPLE';
    }

    return null;
}

export function activateGhostPower(owner, setGhostActive, setGhostOwner, setCooldowns) {
    // Return new state updates mostly
    return {
        ghostActive: POWER_COOLDOWNS.GHOST_DURATION,
        ghostOwner: owner,
        message: owner === 'player' ? "GHOST BALL!" : "AI GHOST BALL!" // Text can be overridden
    };
}

export function activateTriplePower(ball, setDecoys, setCooldowns) {
    const decoys = [
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
    ];

    return {
        decoys,
        message: "TRIPLE THREAT!"
    };
}
