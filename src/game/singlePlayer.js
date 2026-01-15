import { CONSTANTS } from './constants';
import { updateOpponentPaddle } from '../agents/logicAgent';
import {
    checkPlayerPowerActivation,
    checkOpponentPowerActivation,
    activateGhostPower,
    activateTriplePower,
    POWER_COOLDOWNS
} from './powerLogic';

export function updateSinglePlayer({
    ball,
    playerPaddle,
    opponentPaddle,
    score,
    playerCharge,
    opponentCharge,
    cooldowns, // Object containing all cooldowns
    keysPressed,
    handPosition,
    controlMode,
    processHandInput,
    updateState, // Callback to update React state
    refs // { playerHitSinceReset, opponentHitSinceReset, playerReleaseTime, etc }
}) {
    // 1. Process Player Input
    let playerAction;
    if (controlMode === 'hand') {
        playerAction = processHandInput(handPosition, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    } else {
        const speed = 8;
        let newY = playerPaddle.y;
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) newY -= speed;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) newY += speed;

        playerAction = {
            object_action: "move_paddle",
            action_value: newY + CONSTANTS.PADDLE_HEIGHT / 2,
            isSqueezing: keysPressed.current[' '],
            raisedFingers: keysPressed.current['q'] ? 2 : (keysPressed.current['e'] ? 3 : 0)
        };
    }

    // Stabilize Finger Count if history ref is present
    if (refs.fingerHistory && controlMode === 'hand') {
        const rawFingers = playerAction.raisedFingers;
        refs.fingerHistory.current.push(rawFingers);
        if (refs.fingerHistory.current.length > 5) refs.fingerHistory.current.shift();

        // Only update if consistent for 5 frames
        const stableFingers = refs.fingerHistory.current.every(v => v === rawFingers) ? rawFingers : 0;
        playerAction.raisedFingers = stableFingers;
    }


    // 2. Process AI Input
    const aiControl = updateOpponentPaddle(
        ball.y,
        opponentPaddle.y,
        CONSTANTS.PADDLE_HEIGHT,
        ball.x,
        CONSTANTS.CANVAS_WIDTH,
        ball.velocityX
    );

    // Simulate AI fingers for powers
    // Simple AI logic: 
    // If AI just hit ball (moving Left/Away) AND Cooldown Ready -> Use Triple (d100 roll)
    // If Ball moving Away AND Cooldown Ready -> Use Ghost (d100 roll)
    let aiRaisedFingers = 0;

    if (ball.velocityX < 0) { // Moving away from AI (Right side)
        // Chance to trigger powers if available
        if (cooldowns.opponentGhostCooldown <= 0 && Math.random() < 0.02) aiRaisedFingers = 2; // 2% chance per frame if available
        else if (cooldowns.opponentTripleCooldown <= 0 && refs.opponentHitSinceReset.current && Math.random() < 0.02) aiRaisedFingers = 3;
    }

    const aiAction = {
        y: aiControl.y,
        isSqueezing: aiControl.shouldCharge,
        raisedFingers: aiRaisedFingers
    };

    // 3. Move Paddles
    if (playerAction.object_action === 'move_paddle') {
        updateState.setPlayerPaddle(prev => ({
            ...prev,
            y: Math.max(0, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.PADDLE_HEIGHT, playerAction.action_value - CONSTANTS.PADDLE_HEIGHT / 2))
        }));
    }

    updateState.setOpponentPaddle(prev => ({
        ...prev,
        y: Math.max(0, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.PADDLE_HEIGHT, aiAction.y))
    }));

    // 4. Handle Charging
    // Player
    if (playerAction.isSqueezing && cooldowns.playerCooldown <= 0) {
        updateState.setPlayerCharge(prev => Math.min(100, prev + 1.5));
    } else {
        if (refs.playerWasSqueezing.current) refs.playerReleaseTime.current = Date.now();
        updateState.setPlayerCharge(prev => Math.max(0, prev - 1));
    }
    refs.playerWasSqueezing.current = Boolean(playerAction.isSqueezing);

    // AI
    if (aiAction.isSqueezing && cooldowns.opponentCooldown <= 0) {
        updateState.setOpponentCharge(prev => Math.min(100, prev + 1.2));
        refs.opponentWasCharging.current = true;
    } else {
        if (refs.opponentWasCharging.current && aiControl.shouldRelease) {
            refs.opponentReleaseTime.current = Date.now();
        }
        refs.opponentWasCharging.current = false;
        updateState.setOpponentCharge(prev => Math.max(0, prev - 1));
    }

    // 5. Check Power Activation (Gestures)
    // Player
    const playerPower = checkPlayerPowerActivation(playerAction, cooldowns, ball, refs.playerHitSinceReset.current);
    if (playerPower === 'GHOST') {
        const effect = activateGhostPower('player', null, null, null);
        updateState.setGhostActive(effect.ghostActive);
        updateState.setGhostOwner('player');
        updateState.setPlayerGhostCooldown(POWER_COOLDOWNS.GHOST_CD);
        updateState.setPowerMessage("GHOST BALL!");
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    } else if (playerPower === 'TRIPLE') {
        const effect = activateTriplePower(ball, null, null);
        updateState.setDecoys(effect.decoys);
        updateState.setPlayerTripleCooldown(POWER_COOLDOWNS.TRIPLE_CD);
        updateState.setPowerMessage("TRIPLE THREAT!");
        refs.playerHitSinceReset.current = false; // Consume hit
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    }

    // AI
    const aiPower = checkOpponentPowerActivation(aiAction, cooldowns, ball, refs.opponentHitSinceReset.current);
    if (aiPower === 'GHOST') {
        const effect = activateGhostPower('opponent', null, null, null);
        updateState.setGhostActive(effect.ghostActive);
        updateState.setGhostOwner('opponent');
        updateState.setOpponentGhostCooldown(POWER_COOLDOWNS.GHOST_CD);
        updateState.setPowerMessage("AI GHOST BALL!");
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    } else if (aiPower === 'TRIPLE') {
        const effect = activateTriplePower(ball, null, null);
        updateState.setDecoys(effect.decoys);
        updateState.setOpponentTripleCooldown(POWER_COOLDOWNS.TRIPLE_CD);
        updateState.setPowerMessage("AI TRIPLE THREAT!");
        refs.opponentHitSinceReset.current = false;
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    }

    return { playerAction, aiAction }; // Return actions for syncing or debugging if needed
}
