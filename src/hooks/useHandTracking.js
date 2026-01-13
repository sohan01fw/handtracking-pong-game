import { useEffect, useRef, useState } from 'react';

// Use the global constructors from index.html CDN
const getHands = () => window.Hands || (window.HandsNamespace && window.HandsNamespace.Hands);
const getCamera = () => window.Camera || (window.CameraNamespace && window.CameraNamespace.Camera);

export function useHandTracking(enabled = false) {
    const videoRef = useRef(null);
    const [handPosition, setHandPosition] = useState(null);
    const [isReady, setIsReady] = useState(false);

    const handsRef = useRef(null);
    const cameraRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            if (cameraRef.current) {
                cameraRef.current.stop();
                cameraRef.current = null;
            }
            if (handsRef.current) {
                handsRef.current.close();
                handsRef.current = null;
            }
            setIsReady(false);
            setHandPosition(null);
            return;
        }

        let checkInterval;

        const initHandTracking = () => {
            const Hands = getHands();
            const Camera = getCamera();

            if (!Hands || !Camera) {
                return false;
            }

            if (!handsRef.current) {
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
                handsRef.current = hands;
            }

            if (videoRef.current) {
                if (!cameraRef.current) {
                    const camera = new Camera(videoRef.current, {
                        onFrame: async () => {
                            if (handsRef.current) await handsRef.current.send({ image: videoRef.current });
                        },
                        width: 640,
                        height: 480
                    });
                    camera.start();
                    cameraRef.current = camera;
                    setIsReady(true);
                }
                return true;
            }

            return false;
        };

        if (!initHandTracking()) {
            checkInterval = setInterval(() => {
                if (initHandTracking()) {
                    clearInterval(checkInterval);
                }
            }, 100);
        }

        return () => {
            if (checkInterval) clearInterval(checkInterval);
            if (handsRef.current) {
                handsRef.current.close();
                handsRef.current = null;
            }
            if (cameraRef.current) {
                cameraRef.current.stop();
                cameraRef.current = null;
            }
        };
    }, [enabled]);

    return { videoRef, handPosition, isReady };
}
