import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export function useHandTracking() {
    const videoRef = useRef(null);
    const [handPosition, setHandPosition] = useState(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const indexTip = landmarks[8];
                setHandPosition({
                    x: indexTip.x,
                    y: indexTip.y,
                    landmarks: landmarks
                });
            } else {
                setHandPosition(null);
            }
        });

        if (videoRef.current) {
            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    await hands.send({ image: videoRef.current });
                },
                width: 640,
                height: 480
            });
            camera.start();
            setIsReady(true);
        }

        return () => {
            hands.close();
        };
    }, []);

    return { videoRef, handPosition, isReady };
}
