import { CONSTANTS } from './constants';

export function updatePhysics({
    ball,
    playerPaddle,
    opponentPaddle,
    playerCharge,
    opponentCharge,
    playerCooldown,
    opponentCooldown,
    ghostActive,
    ghostOwner,
    soundEnabled,
    refs, // release times, hit flags
    setters, // setScore, setWinner, setBall, setPowerMessage...
    callbacks // playSound
}) {
    // We compute the new ball state
    // We return the new ball state to be set

    let newX = ball.x + ball.velocityX;
    let newY = ball.y + ball.velocityY;
    let newVelocityX = ball.velocityX;
    let newVelocityY = ball.velocityY;

    // Wall Collisions
    if (newY - CONSTANTS.BALL_RADIUS < 0 || newY + CONSTANTS.BALL_RADIUS > CONSTANTS.CANVAS_HEIGHT) {
        newVelocityY = -newVelocityY;
        newY = Math.max(CONSTANTS.BALL_RADIUS, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.BALL_RADIUS, newY));
    }

    // Paddle Collisions

    // Player (Left or Host-Left? Logic assumes Player is Left in SP/Host)
    // Wait, paddle positions in App.jsx depend on Role.
    // In SP: Player x=30.
    // In MP Host: Player x=30.
    // In MP Guest: Player x=Width-30.

    // But this physics runs on HOST/SP. So Player is Left.
    // Check paddle collision logic in App.jsx:
    // It checks `playerPaddle.x` and `opponentPaddle.x`.
    // So it's generic regarding position.

    // Check Player Paddle Collision
    if (newX - CONSTANTS.BALL_RADIUS < playerPaddle.x + CONSTANTS.PADDLE_WIDTH &&
        newX + CONSTANTS.BALL_RADIUS > playerPaddle.x &&
        newY > playerPaddle.y &&
        newY < playerPaddle.y + CONSTANTS.PADDLE_HEIGHT) {

        let multiplier = 1;
        const timeSinceRelease = Date.now() - refs.playerReleaseTime.current;
        if (timeSinceRelease < 400 && playerCharge > 30 && playerCooldown <= 0) {
            multiplier = 3.5;
            setters.setPlayerCharge(0);
            setters.setPlayerCooldown(600);
            setters.setPowerMessage("POWER BLAST!");
            setTimeout(() => setters.setPowerMessage(""), 1000);
        }

        newVelocityX = Math.abs(newVelocityX) * multiplier;
        newX = playerPaddle.x + CONSTANTS.PADDLE_WIDTH + CONSTANTS.BALL_RADIUS;
        const hitPos = (newY - playerPaddle.y) / CONSTANTS.PADDLE_HEIGHT - 0.5;
        newVelocityY += hitPos * 5;
        refs.playerHitSinceReset.current = true;
        if (soundEnabled) callbacks.paddleHitSound.play().catch(() => { });
    }

    // Check Opponent Paddle Collision
    if (newX + CONSTANTS.BALL_RADIUS > opponentPaddle.x &&
        newX - CONSTANTS.BALL_RADIUS < opponentPaddle.x + CONSTANTS.PADDLE_WIDTH &&
        newY > opponentPaddle.y &&
        newY < opponentPaddle.y + CONSTANTS.PADDLE_HEIGHT) {

        let multiplier = 1;
        const timeSinceRelease = Date.now() - refs.opponentReleaseTime.current;
        if (timeSinceRelease < 400 && opponentCharge > 30 && opponentCooldown <= 0) {
            multiplier = 3.5;
            setters.setOpponentCharge(0);
            setters.setOpponentCooldown(600);
            setters.setPowerMessage("OPPONENT BLAST!"); // Text can be dynamic
            setTimeout(() => setters.setPowerMessage(""), 1000);
        }

        newVelocityX = -Math.abs(newVelocityX) * multiplier;
        newX = opponentPaddle.x - CONSTANTS.BALL_RADIUS;
        const hitPos = (newY - opponentPaddle.y) / CONSTANTS.PADDLE_HEIGHT - 0.5;
        newVelocityY += hitPos * 5;

        refs.opponentHitSinceReset.current = true;
        if (soundEnabled) callbacks.paddleHitSound.play().catch(() => { });
    }

    // Scoring
    if (newX < 0) {
        setters.setScore(s => {
            const newOpponentScore = s.opponent + 1;
            if (newOpponentScore >= CONSTANTS.WINNING_SCORE) {
                setters.setWinner('AI'); // Or 'Opponent'
                if (soundEnabled) callbacks.winSound.play().catch(() => { });
            }
            return { ...s, opponent: newOpponentScore };
        });
        refs.playerHitSinceReset.current = false;
        refs.opponentHitSinceReset.current = false;

        // Return reset ball
        return {
            x: CONSTANTS.CANVAS_WIDTH / 2,
            y: CONSTANTS.CANVAS_HEIGHT / 2,
            radius: CONSTANTS.BALL_RADIUS,
            velocityX: 5,
            velocityY: 3,
            isPowered: false,
            isGhost: false
        };
    }

    if (newX > CONSTANTS.CANVAS_WIDTH) {
        setters.setScore(s => {
            const newPlayerScore = s.player + 1;
            if (newPlayerScore >= CONSTANTS.WINNING_SCORE) {
                setters.setWinner('YOU');
                if (soundEnabled) callbacks.winSound.play().catch(() => { });
            }
            return { ...s, player: newPlayerScore };
        });
        refs.playerHitSinceReset.current = false;
        refs.opponentHitSinceReset.current = false;

        return {
            x: CONSTANTS.CANVAS_WIDTH / 2,
            y: CONSTANTS.CANVAS_HEIGHT / 2,
            radius: CONSTANTS.BALL_RADIUS,
            velocityX: -5,
            velocityY: 3,
            isPowered: false,
            isGhost: false
        };
    }

    // Max Velocity Cap
    newVelocityY = Math.max(-15, Math.min(15, newVelocityY));
    newVelocityX = Math.max(-35, Math.min(35, (newVelocityX < 0 ? Math.min(-5, newVelocityX) : Math.max(5, newVelocityX))));

    // Clear Decoys
    if (newX < 100 || newX > CONSTANTS.CANVAS_WIDTH - 100) {
        setters.setDecoys([]);
    } else if (refs.decoys && refs.decoys.length > 0) {
        // Update decoy positions
        const updatedDecoys = refs.decoys.map(d => {
            let dx = d.x + d.velocityX;
            let dy = d.y + d.velocityY;
            let dvy = d.velocityY;

            // Wall bounce for decoys
            if (dy - CONSTANTS.BALL_RADIUS < 0 || dy + CONSTANTS.BALL_RADIUS > CONSTANTS.CANVAS_HEIGHT) {
                dvy = -dvy;
                dy = Math.max(CONSTANTS.BALL_RADIUS, Math.min(CONSTANTS.CANVAS_HEIGHT - CONSTANTS.BALL_RADIUS, dy));
            }

            return { ...d, x: dx, y: dy, velocityY: dvy };
        }).filter(d => d.x > -50 && d.x < CONSTANTS.CANVAS_WIDTH + 50); // Keep them if they are somewhat near

        setters.setDecoys(updatedDecoys);
    }

    return {
        x: newX,
        y: newY,
        velocityX: newVelocityX,
        velocityY: newVelocityY,
        radius: CONSTANTS.BALL_RADIUS,
        isPowered: Math.abs(newVelocityX) > 12,
        isGhost: ghostActive > 0 && (ghostOwner === 'player' ? newVelocityX > 0 : newVelocityX < 0)
    };
}
