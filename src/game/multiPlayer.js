import { CONSTANTS } from './constants';
import {
    checkPlayerPowerActivation,
    checkOpponentPowerActivation,
    activateGhostPower,
    activateTriplePower,
    POWER_COOLDOWNS
} from './powerLogic';

export function updateMultiplayerHost({
    ball,
    playerPaddle,
    opponentPaddle,
    playerCharge,
    opponentCharge, // Used for charge bars
    cooldowns,
    keysPressed,
    handPosition,
    controlMode,
    processHandInput,
    updateState,
    refs,
    mp
}) {
    // 1. Process Host (Player 1) Input
    let hostAction;
    if (controlMode === 'hand') {
        hostAction = processHandInput(handPosition, CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
    } else {
        const speed = 8;
        let newY = playerPaddle.y;
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) newY -= speed;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) newY += speed;

        hostAction = {
            object_action: "move_paddle",
            action_value: newY + CONSTANTS.PADDLE_HEIGHT / 2,
            isSqueezing: keysPressed.current[' '],
            raisedFingers: keysPressed.current['q'] ? 2 : (keysPressed.current['e'] ? 3 : 0)
        };
    }

    // Stabilize Finger Count for Host if history ref is present
    if (refs.fingerHistory && controlMode === 'hand') {
        const rawFingers = hostAction.raisedFingers;
        refs.fingerHistory.current.push(rawFingers);
        if (refs.fingerHistory.current.length > 5) refs.fingerHistory.current.shift();

        const stableFingers = refs.fingerHistory.current.every(v => v === rawFingers) ? rawFingers : 0;
        hostAction.raisedFingers = stableFingers;
    }


    // 2. Process Guest (Player 2) Input
    // We rely on refs/state that was updated by the useEffect listener for pure position
    // But for gestures/powers, we double check the latest data packet if we can access it, 
    // or we assume the useEffect put relevant data into refs.
    // However, since we are moving logic HERE, we should probably check the receivedData here if possible,
    // OR just look at what the useEffect saved.

    // In App.jsx, the useEffect saves paddle Y and Charge.
    // It also pushes to `opponentFingerHistory`.
    // Let's rely on `opponentFingerHistory` which is a ref, so it's accessible here.

    const guestData = mp.receivedData;
    let guestAction = {
        isSqueezing: false,
        raisedFingers: 0
    };

    if (guestData && guestData.type === 'paddle_update') {
        // We use the last received data for control inputs
        guestAction.isSqueezing = guestData.isSqueezing;
        guestAction.raisedFingers = guestData.raisedFingers;
    }

    // IMPORTANT: Stability check should ideally happen here or in the data receiver.
    // Since App.jsx already has logic to push to history in useEffect, we can use `opponentFingerHistory`.
    // Let's assume App.jsx continues to update `opponentFingerHistory` in useEffect.
    // Then we just read the stable value.
    const stableOpponentFingers = refs.opponentFingerHistory.current.every(v => v === guestAction.raisedFingers) ? guestAction.raisedFingers : 0;

    // Override raw fingers with stable ones
    guestAction.raisedFingers = stableOpponentFingers;


    // 3. Move Host Paddle
    if (hostAction.object_action === 'move_paddle') {
        updateState.setPlayerPaddle(prev => ({
            ...prev,
            y: Math.max(0, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.PADDLE_HEIGHT, hostAction.action_value - CONSTANTS.PADDLE_HEIGHT / 2))
        }));
    }

    // 4. Charging Logic
    // Host
    if (hostAction.isSqueezing && cooldowns.playerCooldown <= 0) {
        updateState.setPlayerCharge(prev => Math.min(100, prev + 1.5));
    } else {
        if (refs.playerWasSqueezing.current) refs.playerReleaseTime.current = Date.now();
        updateState.setPlayerCharge(prev => Math.max(0, prev - 1));
    }
    refs.playerWasSqueezing.current = Boolean(hostAction.isSqueezing);

    // Guest - Release timing tracking
    if (refs.opponentWasCharging.current && !guestAction.isSqueezing) {
        refs.opponentReleaseTime.current = Date.now();
    }
    refs.opponentWasCharging.current = guestAction.isSqueezing;


    // 5. Check Power Activation

    // Host (Player) - Logic was missing before!
    const playerPower = checkPlayerPowerActivation(hostAction, cooldowns, ball, refs.playerHitSinceReset.current);
    if (playerPower === 'GHOST') {
        const effect = activateGhostPower('player', null, null, null);
        updateState.setGhostActive(effect.ghostActive);
        updateState.setGhostOwner('player');
        updateState.setPlayerGhostCooldown(POWER_COOLDOWNS.GHOST_CD);
        updateState.setPowerMessage("P1 GHOST BALL!");
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    } else if (playerPower === 'TRIPLE') {
        const effect = activateTriplePower(ball, null, null);
        updateState.setDecoys(effect.decoys);
        updateState.setPlayerTripleCooldown(POWER_COOLDOWNS.TRIPLE_CD);
        updateState.setPowerMessage("P1 TRIPLE THREAT!");
        refs.playerHitSinceReset.current = false;
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    }

    // Guest (Opponent)
    const guestPower = checkOpponentPowerActivation(guestAction, cooldowns, ball, refs.opponentHitSinceReset.current);
    if (guestPower === 'GHOST') {
        const effect = activateGhostPower('opponent', null, null, null);
        updateState.setGhostActive(effect.ghostActive);
        updateState.setGhostOwner('opponent');
        updateState.setOpponentGhostCooldown(POWER_COOLDOWNS.GHOST_CD);
        updateState.setPowerMessage("P2 GHOST BALL!");
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    } else if (guestPower === 'TRIPLE') {
        const effect = activateTriplePower(ball, null, null);
        updateState.setDecoys(effect.decoys);
        updateState.setOpponentTripleCooldown(POWER_COOLDOWNS.TRIPLE_CD);
        updateState.setPowerMessage("P2 TRIPLE THREAT!");
        refs.opponentHitSinceReset.current = false;
        setTimeout(() => updateState.setPowerMessage(""), 1000);
    }
}
